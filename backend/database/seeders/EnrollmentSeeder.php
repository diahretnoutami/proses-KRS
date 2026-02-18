<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class EnrollmentSeeder extends Seeder
{
    public function run(): void
    {
        DB::disableQueryLog();

        $now = now();
        $target = (int) env('SEED_ENROLLMENTS', 5000);
        $batchSize = 5_000;

        $studentCount = (int) DB::table('students')->count(); 
        $courseCount  = (int) DB::table('courses')->count();  

        if ($studentCount === 0 || $courseCount === 0) {
            $this->command?->warn('Students/Courses empty. Seed them first.');
            return;
        }

        
        $minStudentId = (int) DB::table('students')->min('id');
        $minCourseId  = (int) DB::table('courses')->min('id');  

        $years = ['2024/2025', '2025/2026'];
        $termCount = count($years) * 2; 
        $capacity = $studentCount * $courseCount * $termCount; 
        if ($capacity < $target) {
            $this->command?->error("Kombinasi unik maksimal {$capacity}, kurang untuk {$target}.");
            return;
        }

        $statuses = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'];

        $rows = [];
        for ($i = 0; $i < $target; $i++) {
            $termIdx = $i % $termCount;              
            $academicYear = $years[intdiv($termIdx, 2)];
            $semester = ($termIdx % 2) + 1;         
            
            $k = intdiv($i, $termCount);
            $courseOffset  = $k % $courseCount;     
            $studentOffset = intdiv($k, $courseCount);

            $studentId = $minStudentId + $studentOffset;
            $courseId  = $minCourseId + $courseOffset;

            $rows[] = [
                'student_id'    => $studentId,
                'course_id'     => $courseId,
                'academic_year' => $academicYear,
                'semester'      => $semester,
                'status'        => $statuses[array_rand($statuses)],
                'created_at'    => $now,
                'updated_at'    => $now,
            ];

            if (count($rows) >= $batchSize) {
                DB::table('enrollments')->insert($rows);
                $rows = [];

                if ((($i + 1) % 200_000) === 0) {
                    $this->command?->info("Inserted " . ($i + 1) . " rows...");
                }
            }
        }

        if (!empty($rows)) {
            DB::table('enrollments')->insert($rows);
        }

        $this->command?->info("Done. Inserted {$target} enrollments.");
    }
}