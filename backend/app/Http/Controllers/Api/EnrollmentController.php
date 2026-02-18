<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class EnrollmentController extends Controller
{
    public function index(Request $request)
    {
        $page = max((int) $request->query('page', 1), 1);
        $pageSize = (int) $request->query('page_size', 10);
        $pageSize = min(max($pageSize, 1), 100);

        $query = $this->baseQuery();
        $this->applyFiltersAndSearch($query, $request);
        $this->applySorting($query, $request);

        // Total must be computed before pagination
        $total = (clone $query)->count();

        $rows = $query
            ->forPage($page, $pageSize)
            ->get();

        return response()->json([
            'data' => $rows,
            'meta' => [
                'page' => $page,
                'page_size' => $pageSize,
                'total' => $total,
                'total_pages' => (int) ceil($total / $pageSize),
            ],
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        @set_time_limit(0);

        $query = $this->baseQuery();
        $this->applyFiltersAndSearch($query, $request);
        $this->applySorting($query, $request);

        $fileName = 'enrollments_export_' . now()->format('Ymd_His') . '.csv';

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");

            // header
            fputcsv($out, [
                'id',
                'student_nim',
                'student_name',
                'course_code',
                'course_name',
                'semester',
                'academic_year',
                'status',
            ]);

            $i = 0;

            foreach ($query->cursor() as $r) {
                fputcsv($out, [
                    $r->id,
                    $r->student_nim,
                    $r->student_name,
                    $r->course_code,
                    $r->course_name,
                    $r->semester,
                    $r->academic_year,
                    $r->status,
                ]);

                if ((++$i % 5000) === 0) {
                    fflush($out);
                }
            }

            fclose($out);
        }, $fileName, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'no-store, no-cache',
        ]);
    }


    private function baseQuery()
    {
        return DB::table('enrollments as e')
            ->join('students as s', 's.id', '=', 'e.student_id')
            ->join('courses as c', 'c.id', '=', 'e.course_id')
            ->select([
                'e.id',
                's.nim as student_nim',
                's.name as student_name',
                'c.code as course_code',
                'c.name as course_name',
                'e.semester',
                'e.academic_year',
                'e.status',
                'e.student_id',
                'e.course_id',
            ]);
    }

    private function applyFiltersAndSearch($query, Request $request): void
    {
        // ------------------------- quick filters -----------------------
        $status = $request->query('status');
        $semester = $request->query('semester');
        $academicYear = trim((string) $request->query('academic_year', ''));

        $allowedStatuses = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'];

        if (is_string($status) && $status !== '' && strtoupper($status) !== 'ALL') {
            $status = strtoupper($status);
            if (in_array($status, $allowedStatuses, true)) {
                $query->where('e.status', $status);
            }
        }

        if ($semester !== null && $semester !== '' && (string) $semester !== 'ALL') {
            $sem = (int) $semester;
            if (in_array($sem, [1, 2], true)) {
                $query->where('e.semester', $sem);
            }
        }

        if ($academicYear !== '' && strtoupper($academicYear) !== 'ALL') {
            if (preg_match('/^\d{4}\/\d{4}$/', $academicYear) === 1) {
                $query->where('e.academic_year', $academicYear);
            }
        }

        // -------------------- live search ------------------------------------------------------
        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $like = '%' . str_replace(['%', '_'], ['\%', '\_'], $search) . '%';

            $query->where(function ($q) use ($like) {
                $q->where('s.nim', 'ILIKE', $like)
                    ->orWhere('s.name', 'ILIKE', $like)
                    ->orWhere('c.code', 'ILIKE', $like);
            });
        }

        // ---------------------- advanced filters --------------------
        $filtersRaw = $request->query('filters');
        $filterLogic = strtoupper((string) $request->query('filter_logic', 'AND'));
        $filterLogic = in_array($filterLogic, ['AND', 'OR'], true) ? $filterLogic : 'AND';

        $allowedFields = [
            'student_nim'   => 's.nim',
            'student_name'  => 's.name',
            'course_code'   => 'c.code',
            'course_name'   => 'c.name',
            'semester'      => 'e.semester',
            'academic_year' => 'e.academic_year',
            'status'        => 'e.status',
        ];

        $allowedOps = ['contains', 'startsWith', 'equals', 'between', 'in'];

        if (is_string($filtersRaw) && trim($filtersRaw) !== '') {
            $decoded = json_decode($filtersRaw, true);

            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $query->where(function ($group) use ($decoded, $filterLogic, $allowedFields, $allowedOps) {
                    foreach ($decoded as $rule) {
                        if (!is_array($rule)) continue;

                        $field = $rule['field'] ?? null;
                        $op    = $rule['op'] ?? null;
                        $value = $rule['value'] ?? null;

                        if (!is_string($field) || !isset($allowedFields[$field])) continue;
                        if (!is_string($op) || !in_array($op, $allowedOps, true)) continue;

                        $col = $allowedFields[$field];

                        $applyRule = function ($q) use ($field, $op, $value, $col) {
                            $escapeLike = function (string $s) {
                                return str_replace(['%', '_'], ['\%', '\_'], $s);
                            };

                            if ($op === 'contains') {
                                if (!is_string($value) || $value === '') return;
                                $q->where($col, 'ILIKE', '%' . $escapeLike($value) . '%');
                                return;
                            }

                            if ($op === 'startsWith') {
                                if (!is_string($value) || $value === '') return;
                                $q->where($col, 'ILIKE', $escapeLike($value) . '%');
                                return;
                            }

                            if ($op === 'equals') {
                                if ($value === null || $value === '') return;
                                $q->where($col, '=', $value);
                                return;
                            }

                            if ($op === 'between') {
                                if (!is_array($value) || count($value) !== 2) return;
                                [$from, $to] = $value;
                                if ($from === null || $to === null || $from === '' || $to === '') return;
                                $q->whereBetween($col, [$from, $to]);
                                return;
                            }

                            if ($op === 'in') {
                                if (!is_array($value) || count($value) === 0) return;

                                if ($field === 'semester') {
                                    $vals = array_values(array_filter(
                                        array_map(fn($v) => (int) $v, $value),
                                        fn($v) => in_array($v, [1, 2], true)
                                    ));
                                    if (!$vals) return;
                                    $q->whereIn($col, $vals);
                                    return;
                                }

                                if ($field === 'status') {
                                    $allowedStatuses = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'];
                                    $vals = array_values(array_filter(
                                        array_map(fn($v) => strtoupper((string) $v), $value),
                                        fn($v) => in_array($v, $allowedStatuses, true)
                                    ));
                                    if (!$vals) return;
                                    $q->whereIn($col, $vals);
                                    return;
                                }

                                $q->whereIn($col, $value);
                                return;
                            }
                        };

                        if ($filterLogic === 'OR') {
                            $group->orWhere(function ($q) use ($applyRule) {
                                $applyRule($q);
                            });
                        } else {
                            $group->where(function ($q) use ($applyRule) {
                                $applyRule($q);
                            });
                        }
                    }
                });
            }
        }
    }

    private function applySorting($query, Request $request): void
    {
        $sortable = [
            'id'            => 'e.id',
            'student_nim'   => 's.nim',
            'student_name'  => 's.name',
            'course_code'   => 'c.code',
            'course_name'   => 'c.name',
            'semester'      => 'e.semester',
            'academic_year' => 'e.academic_year',
            'status'        => 'e.status',
            'created_at'    => 'e.created_at',
            'updated_at'    => 'e.updated_at',
        ];

        $sortsRaw = $request->query('sorts');
        $appliedAnySort = false;

        if (is_string($sortsRaw) && trim($sortsRaw) !== '') {
            $decodedSorts = json_decode($sortsRaw, true);

            if (json_last_error() === JSON_ERROR_NONE && is_array($decodedSorts)) {
                foreach ($decodedSorts as $s) {
                    if (!is_array($s)) continue;

                    $field = $s['field'] ?? null;
                    $dir = strtolower((string) ($s['dir'] ?? 'asc'));
                    $dir = $dir === 'desc' ? 'desc' : 'asc';

                    if (!is_string($field) || !isset($sortable[$field])) continue;

                    $query->orderBy($sortable[$field], $dir);
                    $appliedAnySort = true;
                }
            }
        }

        if (!$appliedAnySort) {
            $sortBy = (string) $request->query('sort_by', 'id');
            $sortDir = strtolower((string) $request->query('sort_dir', 'desc')) === 'asc' ? 'asc' : 'desc';
            $sortCol = $sortable[$sortBy] ?? 'e.id';

            $query->orderBy($sortCol, $sortDir);
        }

        if (!$appliedAnySort) {
            $query->orderBy('e.id', 'desc');
        }
    }

    public function storeAtomic(Request $request)
    {
        $request->validate([
            'student' => ['required', 'array'],
            'student.mode' => ['required', Rule::in(['existing', 'new'])],

            'course' => ['required', 'array'],
            'course.mode' => ['required', Rule::in(['existing', 'new'])],

            'enrollment' => ['required', 'array'],
            'enrollment.academic_year' => ['required', 'regex:/^\d{4}\/\d{4}$/'],
            'enrollment.semester' => ['required', Rule::in([1, 2])],
        ]);

        if ($request->input('student.mode') === 'existing') {
            $request->validate([
                'student.id' => ['required', 'integer', 'exists:students,id'],
            ]);
        } else {
            $request->validate([
                'student.nim' => ['required', 'regex:/^\d{8,12}$/'], // 8–12 digit
                'student.name' => ['required', 'string', 'min:3', 'max:100'],
                'student.email' => ['required', 'email', 'max:255'],
            ]);
        }

        if ($request->input('course.mode') === 'existing') {
            $request->validate([
                'course.id' => ['required', 'integer', 'exists:courses,id'],
            ]);
        } else {
            $request->validate([
                'course.code' => ['required', 'regex:/^[A-Z]{2,4}[0-9]{3}$/'],
                'course.name' => ['required', 'string', 'min:3', 'max:120'],
                'course.credits' => ['required', 'integer', 'min:1', 'max:6'],
            ]);
        }

        $academicYear = trim((string) $request->input('enrollment.academic_year'));
        $semester = (int) $request->input('enrollment.semester');

        try {
            $result = DB::transaction(function () use ($request, $academicYear, $semester) {

                $studentMode = $request->input('student.mode');

                if ($studentMode === 'existing') {
                    $studentId = (int) $request->input('student.id');
                } else {
                    $nim = trim((string) $request->input('student.nim'));
                    $name = trim((string) $request->input('student.name'));
                    $email = trim((string) $request->input('student.email'));

                    $student = DB::table('students')
                        ->where('nim', $nim)
                        ->orWhere('email', $email)
                        ->first();

                    if ($student) {
                        if ($student->nim !== $nim || $student->email !== $email) {
                            throw ValidationException::withMessages([
                                'student' => ['NIM atau email sudah dipakai oleh student lain.'],
                            ]);
                        }

                        DB::table('students')->where('id', $student->id)->update([
                            'name' => $name,
                            'updated_at' => now(),
                        ]);

                        $studentId = (int) $student->id;
                    } else {
                        $studentId = (int) DB::table('students')->insertGetId([
                            'nim' => $nim,
                            'name' => $name,
                            'email' => $email,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }

                $courseMode = $request->input('course.mode');

                if ($courseMode === 'existing') {
                    $courseId = (int) $request->input('course.id');
                } else {
                    $code = strtoupper(trim((string) $request->input('course.code')));
                    $cName = trim((string) $request->input('course.name'));
                    $credits = (int) $request->input('course.credits');

                    $course = DB::table('courses')->where('code', $code)->first();

                    if ($course) {
                        DB::table('courses')->where('id', $course->id)->update([
                            'name' => $cName,
                            'credits' => $credits,
                            'updated_at' => now(),
                        ]);

                        $courseId = (int) $course->id;
                    } else {
                        $courseId = (int) DB::table('courses')->insertGetId([
                            'code' => $code,
                            'name' => $cName,
                            'credits' => $credits,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }

                $status = 'SUBMITTED';

                $exists = DB::table('enrollments')
                    ->where('student_id', $studentId)
                    ->where('course_id', $courseId)
                    ->where('academic_year', $academicYear)
                    ->where('semester', $semester)
                    ->exists();

                if ($exists) {
                    throw ValidationException::withMessages([
                        'enrollment' => ['KRS sudah ada untuk student+mk+tahun+semester tersebut.'],
                    ]);
                }

                $enrollmentId = (int) DB::table('enrollments')->insertGetId([
                    'student_id' => $studentId,
                    'course_id' => $courseId,
                    'academic_year' => $academicYear,
                    'semester' => $semester,
                    'status' => $status,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                return [
                    'enrollment_id' => $enrollmentId,
                    'student_id' => $studentId,
                    'course_id' => $courseId,
                    'status' => $status,
                ];
            });

            return response()->json([
                'message' => 'Created',
                'data' => $result,
            ], 201);
        } catch (ValidationException $e) {
            throw $e;
        }
    }

    public function update(Request $request, $id)
    {
        $id = (int) $id;

        $current = DB::table('enrollments')->where('id', $id)->first();
        if (!$current) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $request->validate([
            'course' => ['required', 'array'],
            'course.mode' => ['required', Rule::in(['existing'])],
            'course.id' => ['required', 'integer', 'exists:courses,id'],

            'enrollment' => ['required', 'array'],
            'enrollment.academic_year' => ['required', 'regex:/^\d{4}\/\d{4}$/'],
            'enrollment.semester' => ['required', Rule::in([1, 2])],
            'enrollment.status' => ['required', Rule::in(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'])],
        ]);

        $studentId = (int) $current->student_id;
        $courseId = (int) $request->input('course.id');
        $academicYear = trim((string) $request->input('enrollment.academic_year'));
        $semester = (int) $request->input('enrollment.semester');
        $status = strtoupper((string) $request->input('enrollment.status'));

        try {
            DB::transaction(function () use ($id, $studentId, $courseId, $academicYear, $semester, $status) {

                $dup = DB::table('enrollments')
                    ->where('student_id', $studentId)
                    ->where('course_id', $courseId)
                    ->where('academic_year', $academicYear)
                    ->where('semester', $semester)
                    ->where('id', '!=', $id)
                    ->exists();

                if ($dup) {
                    throw ValidationException::withMessages([
                        'enrollment' => ['KRS duplikat untuk student+mk+tahun+semester tersebut.'],
                    ]);
                }

                DB::table('enrollments')
                    ->where('id', $id)
                    ->update([
                        'course_id' => $courseId,
                        'academic_year' => $academicYear,
                        'semester' => $semester,
                        'status' => $status,
                        'updated_at' => now(),
                    ]);
            });

            return response()->json(['message' => 'Updated']);
        } catch (ValidationException $e) {
            throw $e;
        }
    }

    public function show($id)
    {
        $row = (clone $this->baseQuery())
            ->where('e.id', (int) $id)
            ->first();

        if (!$row) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['data' => $row]);
    }


    public function destroy($id)
    {
        $deleted = DB::table('enrollments')->where('id', $id)->delete();
        if (!$deleted) {
            return response()->json(['message' => 'Not found'], 404);
        }
        return response()->json(['message' => 'Deleted']);
    }
}