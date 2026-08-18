const XLSX = require('xlsx')
const path = require('path')
const fs = require('fs')

// 1. Generate Student Sample Excel
const studentData = [
  { 'Roll No': '1NT23CS001', 'Name': 'Aditya Sharma', 'Department': 'CSE', 'Semester': 5, 'Phone': '9876543210', 'Email': 'aditya.sharma@college.edu' },
  { 'Roll No': '1NT23CS002', 'Name': 'Ananya Verma', 'Department': 'CSE', 'Semester': 5, 'Phone': '9876543211', 'Email': 'ananya.verma@college.edu' },
  { 'Roll No': '1NT23EC015', 'Name': 'Rohan Kulkarni', 'Department': 'ECE', 'Semester': 5, 'Phone': '9876543212', 'Email': 'rohan.kulkarni@college.edu' },
  { 'Roll No': '1NT23IS024', 'Name': 'Sneha Patel', 'Department': 'ISE', 'Semester': 3, 'Phone': '9876543213', 'Email': 'sneha.patel@college.edu' },
  { 'Roll No': '1NT23ME008', 'Name': 'Vikram Singh', 'Department': 'ME', 'Semester': 7, 'Phone': '9876543214', 'Email': 'vikram.singh@college.edu' },
]

const studentWs = XLSX.utils.json_to_sheet(studentData)
const studentWb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(studentWb, studentWs, 'Students')

const studentPathBackend = path.join(__dirname, 'sample_students.xlsx')
const studentPathFrontend = path.join(__dirname, '../frontend/public/sample_students.xlsx')

XLSX.writeFile(studentWb, studentPathBackend)
XLSX.writeFile(studentWb, studentPathFrontend)
console.log('✅ Generated sample_students.xlsx')

// 2. Generate Faculty Sample Excel
const facultyData = [
  { 'Employee ID': 'EMP101', 'Name': 'Dr. John Smith', 'Department': 'CSE', 'Phone': '9988776655', 'Email': 'john.smith@college.edu' },
  { 'Employee ID': 'EMP102', 'Name': 'Dr. Jane Doe', 'Department': 'ECE', 'Phone': '9988776656', 'Email': 'jane.doe@college.edu' },
  { 'Employee ID': 'EMP103', 'Name': 'Prof. Rajesh Kumar', 'Department': 'ME', 'Phone': '9988776657', 'Email': 'rajesh.kumar@college.edu' },
  { 'Employee ID': 'EMP104', 'Name': 'Dr. Sunita Rao', 'Department': 'ISE', 'Phone': '9988776658', 'Email': 'sunita.rao@college.edu' },
]

const facultyWs = XLSX.utils.json_to_sheet(facultyData)
const facultyWb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(facultyWb, facultyWs, 'Faculty')

const facultyPathBackend = path.join(__dirname, 'sample_faculty.xlsx')
const facultyPathFrontend = path.join(__dirname, '../frontend/public/sample_faculty.xlsx')

XLSX.writeFile(facultyWb, facultyPathBackend)
XLSX.writeFile(facultyWb, facultyPathFrontend)
console.log('✅ Generated sample_faculty.xlsx')
