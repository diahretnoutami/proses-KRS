<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CourseController extends Controller
{
    public function index(Request $request)
    {
        $search = trim((string) $request->query('search', ''));

        $q = DB::table('courses')
            ->select(['id', 'code', 'name', 'credits']);

        if ($search !== '') {
            $like = '%' . str_replace(['%', '_'], ['\%', '\_'], $search) . '%';
            $q->where(function ($w) use ($like) {
                $w->where('code', 'ILIKE', $like)
                  ->orWhere('name', 'ILIKE', $like);
            });
        }

        $rows = $q->orderBy('code', 'asc')
                  ->limit(200)
                  ->get();

        return response()->json(['data' => $rows]);
    }
}