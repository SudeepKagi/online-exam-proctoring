const axios = require('axios');

async function testReg() {
  try {
    const payload = {
      name: 'Test Student',
      usn: '1TT22CS001',
      email: 'testtest@gmail.com',
      password: 'password123',
      department: 'CS',
      semester: '6',
      phone: '1234567890',
      facePhotoBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      idCardBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    };
    
    const res = await axios.post('http://localhost:5000/api/auth/student/register', payload);
    console.log('Success:', res.data);
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
  }
}
testReg();
