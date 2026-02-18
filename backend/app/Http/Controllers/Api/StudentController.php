<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StudentController extends Controller
{
    public function index(Request $request)
    {
        $search = trim((string) $request->query('search', ''));

        $q = DB::table('students')
            ->select(['id', 'nim', 'name', 'email']);

        if ($search !== '') {
            $like = '%' . str_replace(['%', '_'], ['\%', '\_'], $search) . '%';
            $q->where(function ($w) use ($like) {
                $w->where('nim', 'ILIKE', $like)
                  ->orWhere('name', 'ILIKE', $like)
                  ->orWhere('email', 'ILIKE', $like);
            });
        }

        $rows = $q->orderBy('nim', 'asc')
                  ->limit(200) 
                  ->get();

        return response()->json(['data' => $rows]);
    }
}