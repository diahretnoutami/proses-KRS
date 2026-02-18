<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CourseSeeder extends Seeder
{
    public function run(): void
    {
        DB::disableQueryLog();
        $now = now();

        $batch = [];
        $chunk = 1000;

        for ($i = 101; $i <= 999; $i++) {
            $code = "IF" . str_pad((string)$i, 3, "0", STR_PAD_LEFT);

            $batch[] = [
                'code' => $code,
                'name' => "Course {$code}",
                'credits' => (($i - 1) % 6) + 1,
                'created_at' => $now,
                'updated_at' => $now,
            ];

            if (count($batch) >= $chunk) {
                DB::table('courses')->insert($batch);
                $batch = [];
            }
        }

        if ($batch) DB::table('courses')->insert($batch);
    }
}