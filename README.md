# KRS / Enrollment Single Page CRUD (Full Stack)

## Demo
- App URL: ...
- (Optional) Demo account: ...
- Export: tombol Export di halaman utama / endpoint: ...

## Tech Stack
- Frontend: ...
- Backend: ...
- DB: PostgreSql
- (Optional) Deployment: ...

## Features
- CRUD Enrollments (KRS) + relasi Students & Courses
- Create menggunakan 1 transaksi yang melibatkan 3 tabel (students, courses, enrollments)
- Server-side pagination, sorting, quick filter, live search, advanced filter (AND/OR)
- Export seluruh data (hingga 5.000.000 rows) sesuai filter/query
- Seeder >= 5.000.000 rows

## Database Schema
- students(id, nim, name, email, ...)
- courses(id, code, name, credits, ...)
- enrollments(id, student_id FK, course_id FK, academic_year, semester, status, ...)

Delete strategy: (hard/soft) + impact: ...
Update strategy: (apakah update student/course ikut atau tidak) ...
