<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\EnrollmentController;
use App\Http\Controllers\Api\StudentController;
use App\Http\Controllers\Api\CourseController;

Route::get('/enrollments', [EnrollmentController::class, 'index']);
Route::get('/enrollments/export', [EnrollmentController::class, 'export']); 
Route::post('/enrollments', [EnrollmentController::class, 'storeAtomic']);
Route::delete('/enrollments/{id}', [EnrollmentController::class, 'destroy']);
Route::get('/enrollments/{id}', [EnrollmentController::class, 'show']);
Route::put('/enrollments/{id}', [EnrollmentController::class, 'update']);


Route::get('/students', [StudentController::class, 'index']);
Route::get('/courses', [CourseController::class, 'index']);