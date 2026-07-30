const xlsx = require('xlsx')
const fs = require('fs')
const path = require('path')

// Create sample excel file for testing
const studentData = [
  { Name: 'Aarav Sharma', USN: '1MS21CS001', Department: 'CSE', Semester: 6, Phone: '9876543210', Email: 'aarav@mit.ac.in' },
  { Name: 'Ananya Rao', USN: '1MS21CS002', Department: 'CSE', Semester: 6, Phone: '9876543211', Email: 'ananya@mit.ac.in' },
  { Name: 'Priya Nair', USN: '1MS21CS003', Department: 'ECE', Semester: 4, Phone: '9876543212', Email: 'priya@mit.ac.in' },
]

const facultyData = [
  { Name: 'Dr. Ramesh Kumar', EmployeeID: 'EMP501', Department: 'CSE', Phone: '9123456780', Email: 'ramesh.cs@mit.ac.in' },
  { Name: 'Prof. Sunita Patil', EmployeeID: 'EMP502', Department: 'ECE', Phone: '9123456781', Email: 'sunita.ec@mit.ac.in' },
]

const studentSheet = xlsx.utils.json_to_sheet(studentData)
const facultySheet = xlsx.utils.json_to_sheet(facultyData)

const wbStudent = xlsx.utils.book_new()
xlsx.utils.book_append_sheet(wbStudent, studentSheet, 'Students')
xlsx.writeFile(wbStudent, path.join(__dirname, 'sample_students.xlsx'))

const wbFaculty = xlsx.utils.book_new()
xlsx.utils.book_append_sheet(wbFaculty, facultySheet, 'Faculty')
xlsx.writeFile(wbFaculty, path.join(__dirname, 'sample_faculty.xlsx'))

console.log('Sample Excel files sample_students.xlsx and sample_faculty.xlsx created successfully!')
