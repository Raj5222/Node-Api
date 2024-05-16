const express = require('express');
const multer = require('multer');
const { ImageAnnotatorClient } = require('@google-cloud/vision');
const fs = require('fs');
const { promisify } = require('util');
const cors = require('cors');

const app = express();
const port = 8080;

const client = new ImageAnnotatorClient({
  keyFilename: '/etc/secrets/Raw_data.json'
});

const readFileAsync = promisify(fs.readFile);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors()); // Enable CORS

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Route to handle the image upload and face detection.
app.post('/', upload.single('image'), async (req, res) => {
  try {
    // Read the image file from memory.
    const image = await readFileAsync(req.file.buffer);

    // Call the Google Cloud Vision API to detect faces and objects.
    const [faceResult, objectResult] = await Promise.all([
      client.faceDetection({ image }),
      client.objectLocalization({ image })
    ]);

    // Parse the face detection result.
    const faceData = faceResult[0].faceAnnotations.map((face, i) => ({
      label: `Face ${i + 1}`,
      vertices: face.boundingPoly.vertices.map(vertex => [
        vertex.x, // Convert normalized x-coordinate to pixel position
        vertex.y  // Convert normalized y-coordinate to pixel position
      ])
    }));

    // Parse the object detection result.
    const objectData = objectResult[0].localizedObjectAnnotations.map(obj => ({
      label: obj.name,
      vertices: obj.boundingPoly.normalizedVertices.map(vertex => [
        vertex.x * req.file.width, // Convert normalized x-coordinate to pixel position
        vertex.y * req.file.height // Convert normalized y-coordinate to pixel position
      ])
    }));

    res.json({ faces: faceData, objects: objectData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
});
