const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function listAllPhotos() {
  console.log('Fetching files from Cloudinary account:', process.env.CLOUDINARY_CLOUD_NAME);
  try {
    const folders = ['proctornet/faces', 'proctornet/idcards', 'proctornet/faculty-profiles', 'proctornet/faculty-ids', 'proctornet/invigilator-ids'];
    
    for (const folder of folders) {
      console.log(`\n--- Files in folder: ${folder} ---`);
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: folder,
        max_results: 50
      });
      
      if (result.resources.length === 0) {
        console.log('No files found.');
      } else {
        result.resources.forEach(resource => {
          console.log(`- Public ID: ${resource.public_id}`);
          console.log(`  URL:       ${resource.secure_url}`);
          console.log(`  Created:   ${resource.created_at}`);
        });
      }
    }
  } catch (error) {
    console.error('Error listing photos:', error.message);
  }
}

listAllPhotos();
