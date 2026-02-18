<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class StudentSeeder extends Seeder
{
    public function run(): void
    {
        DB::disableQueryLog();
        $now = now();

        $startNim = 215500001;
        $totalStudents = 50000;   // aman untuk 5 juta enrollments
        $chunk = 5000;

        for ($i = 0; $i < $totalStudents; $i += $chunk) {
            $batch = [];
            $end = min($i + $chunk, $totalStudents);

            for ($k = $i; $k < $end; $k++) {
                $nim = (string)($startNim + $k);

                $batch[] = [
                    'nim' => $nim,
                    'name' => "Student " . ($k + 1),
                    'email' => "student" . ($k + 1) . "@example.com",
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            DB::table('students')->insert($batch);
        }
    }
}