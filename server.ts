import express from 'express';
import path from 'path';
import multer from 'multer';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

// Lazy loaded Gemini API initialization
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY key is missing in your Secrets. Please configured it in Settings > Secrets.');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

// Read firebase config safely
let firebaseConfig: any = {};
try {
  const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(firebaseConfigPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
  } else {
    console.warn('[SERVER] Warning: firebase-applet-config.json not found. Using empty config.');
  }
} catch (error) {
  console.error('[SERVER] Error reading firebase-applet-config.json:', error);
}

// Initialize Firebase Admin SDK
// This works automatically in Cloud Run using the default service account
admin.initializeApp({
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket
});

console.log(`[SERVER] Initialized Firebase Admin for project: ${firebaseConfig.projectId}`);
console.log(`[SERVER] Using storage bucket from config: ${firebaseConfig.storageBucket}`);

// We'll try to get the bucket, but we'll also have a helper to try fallbacks if the first one fails
let bucket = admin.storage().bucket(firebaseConfig.storageBucket);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Static uploads serving fallback
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Health check for platform probes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Analyze photo for people recognition (Gemini Multimodal input)
  app.post('/api/studio/analyze', async (req: any, res: any) => {
    console.log(`[API] Triggered /api/studio/analyze`);
    try {
      const { image, mimeType } = req.body;
      if (!image) {
        return res.status(400).json({ error: 'Falta la imagen para analizar.' });
      }

      // Base64 cleaning representation
      let base64Data = image;
      if (image.includes('base64,')) {
        base64Data = image.split('base64,')[1];
      }

      let gemini;
      try {
        gemini = getGeminiClient();
      } catch (err: any) {
        console.warn(`[API] Gemini client initialization warning: ${err.message}. Using creative preview mode.`);
        return res.json({
          previewOnly: true,
          people: [
            { id: "p1", label: "Personaje 1", description: "Rapero a la izquierda (gorra de béisbol, mirada al frente)", originalOutfit: "Camiseta negra gigante" },
            { id: "p2", label: "Personaje 2", description: "Productor en el medio (cascos de audio tipo DJ)", originalOutfit: "Sudadera azul holgada con logo" }
          ]
        });
      }

      const promptStr = `You are a professional image analysis assistant for a music studio outfit design pipeline. 
Analyze this photo and detect all distinct human individuals present. For each person found:
- Create a clear ID like "p1", "p2", etc.
- Provide a brief description specifying their appearance, position in the photo (e.g., left, center, right), hair, or other landmarks so the user can easily locate who they are.
- Mention their current identified clothing (originalOutfit).

Format the output strictly as a JSON array where each object has "id", "label" (e.g. "Personaje 1"), "description" (in Spanish), and "originalOutfit" (in Spanish).
Output ONLY the JSON array, with no markdown code block wraps.`;

      const response = await gemini.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType || 'image/jpeg'
            }
          },
          promptStr
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text || '[]';
      console.log(`[API] Analyzed output:`, text);
      const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const decodedPeople = JSON.parse(cleanedText);

      res.json({ people: decodedPeople });

    } catch (error: any) {
      console.error('[API] Error in /api/studio/analyze:', error);
      res.json({
        previewOnly: true,
        people: [
          { id: "p1", label: "Personaje 1", description: "Artista principal (Izquierda, ropa estilo calle)", originalOutfit: "Sudadera gris con capucha" },
          { id: "p2", label: "Personaje 2", description: "Rapero acompañante (Derecha, brazos cruzados)", originalOutfit: "Camiseta oscura y tejanos" }
        ],
        warning: error.message
      });
    }
  });

  // Generate outfit swap picture (Gemini image-to-image / content edit)
  app.post('/api/studio/render-outfits', async (req: any, res: any) => {
    console.log(`[API] Triggered /api/studio/render-outfits`);
    try {
      const { image, mimeType, people } = req.body;
      if (!image) {
        return res.status(400).json({ error: 'Falta la imagen original' });
      }

      let gemini;
      try {
        gemini = getGeminiClient();
      } catch (err: any) {
        throw new Error('Sin clave Gemini configurada en Settings > Secrets.');
      }

      // Base64 cleaning
      let base64Data = image;
      if (image.includes('base64,')) {
        base64Data = image.split('base64,')[1];
      }

      const outfitsDesc = people
        .map((p: any) => `- El personaje "${p.id}" (${p.description}) que originalmente vestía "${p.originalOutfit}" ahora debe llevar puesto: "${p.newOutfit || 'Su vestuario original'}"`)
        .join('\n');

      const promptStr = `You are an expert virtual clothing and outfit stylist. 
Your task is to modify ONLY the clothing of the specified individuals in the uploaded picture.

MODIFICATIONS TO APPLY:
${outfitsDesc}

CRITICAL STYLING RULES:
1. Poses, facial features, expressions, eye colors, mouths, hair, head accessories, hands, body proportions, and background environment must remain 100% IDENTICAL and untouched.
2. Only change the fabrics, styles, colors, and textures of the apparel (shirts, jackets, hoodies, chains, or hats) worn on the bodies.
3. The newly generated outfits must match the lighting, perspective, shadows, and overall high-quality realistic photo quality.
4. Output the newly updated image.`;

      console.log(`[API] Sending tryon prompt to gemini-2.5-flash-image...`);

      const response = await gemini.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType || 'image/jpeg'
            }
          },
          {
            text: promptStr
          }
        ]
      });

      let generatedBase64 = '';
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            generatedBase64 = part.inlineData.data;
            break;
          }
        }
      }

      if (!generatedBase64) {
        console.warn(`[API] Gemini did not return inlineData image. Trying text response analysis...`);
        throw new Error('El modelo de edición de imagen de Gemini no devolvió datos binarios. Comprueba tu clave o vuelve a intentarlo.');
      }

      const returnedMime = mimeType || 'image/jpeg';
      res.json({ image: `data:${returnedMime};base64,${generatedBase64}` });

    } catch (error: any) {
      console.error('[API] Error in /api/studio/render-outfits:', error);
      res.status(500).json({ 
        error: error.message || 'Error en la conexión con la API de generación de Imagen.'
      });
    }
  });

  // API to list local radio files from assets/radio
  app.get('/api/radio-local-songs', (req, res) => {
    try {
      const devPath = path.join(process.cwd(), 'public', 'assets', 'radio');
      const prodPath = path.join(process.cwd(), 'dist', 'assets', 'radio');
      let dir = devPath;
      if (fs.existsSync(prodPath)) {
        dir = prodPath;
      } else if (!fs.existsSync(devPath)) {
        fs.mkdirSync(devPath, { recursive: true });
      }

      const files = fs.readdirSync(dir);
      const allowedExts = ['.mp3', '.wav', '.ogg', '.m4a'];
      const tracks = files
        .filter(f => allowedExts.includes(path.extname(f).toLowerCase()))
        .map((f, i) => {
          const filePath = path.join(dir, f);
          let statSize = 0;
          try {
            statSize = fs.statSync(filePath).size;
          } catch (e) {}

          // Detect clean name by removing extension and formatting
          const cleanTitle = path.basename(f, path.extname(f))
            .replace(/[_-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          return {
            id: `local-radio-${i}-${encodeURIComponent(f)}`,
            artistId: 'local-radio-artist',
            artistName: statSize === 0 ? 'RAPLIFE RADIO (VACÍO - 0 bytes)' : 'RAPLIFE RADIO',
            title: cleanTitle,
            audioUrl: `/assets/radio/${encodeURIComponent(f)}`,
            coverUrl: '/assets/player_idle.png',
            isRadioInterstitial: true,
            size: statSize
          };
        });

      res.json(tracks);
    } catch (err: any) {
      console.error('[API] Error listing local radio files:', err);
      res.status(500).json({ error: err.message || 'Error listing local radio files' });
    }
  });

  // Multer setup for memory storage (max 50MB for now)
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } 
  });

  // API to upload local radio files directly to public/assets/radio
  app.post('/api/upload-radio-local', upload.single('track'), (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se recibió ningún archivo de audio' });
      }
      const originalName = req.file.originalname;
      const allowedExts = ['.mp3', '.wav', '.ogg', '.m4a'];
      const fileExt = path.extname(originalName).toLowerCase();
      
      if (!allowedExts.includes(fileExt)) {
        return res.status(400).json({ error: 'Formato de audio no permitido. Usa MP3, WAV, OGG o M4A' });
      }

      const devPath = path.join(process.cwd(), 'public', 'assets', 'radio');
      const prodPath = path.join(process.cwd(), 'dist', 'assets', 'radio');
      
      let dir = devPath;
      if (fs.existsSync(prodPath)) {
        dir = prodPath;
      } else if (!fs.existsSync(devPath)) {
        fs.mkdirSync(devPath, { recursive: true });
      }

      // Save the file
      const destinationPath = path.join(dir, originalName);
      fs.writeFileSync(destinationPath, req.file.buffer);

      console.log(`[API] Guardado archivo de radio local con éxito: ${destinationPath}`);
      res.json({ success: true, fileName: originalName });
    } catch (err: any) {
      console.error('[API] Error guardando archivo local de radio:', err);
      res.status(500).json({ error: err.message || 'Error al guardar archivo local de radio' });
    }
  });

  // API to delete local radio files from assets/radio
  app.delete('/api/delete-radio-local', express.json(), (req: any, res: any) => {
    try {
      const { fileName } = req.body;
      if (!fileName) {
        return res.status(400).json({ error: 'Nombre de archivo requerido' });
      }

      const devPath = path.join(process.cwd(), 'public', 'assets', 'radio', fileName);
      const prodPath = path.join(process.cwd(), 'dist', 'assets', 'radio', fileName);

      let deleted = false;
      if (fs.existsSync(devPath)) {
        fs.unlinkSync(devPath);
        deleted = true;
      }
      if (fs.existsSync(prodPath)) {
        fs.unlinkSync(prodPath);
        deleted = true;
      }

      if (deleted) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Archivo no encontrado' });
      }
    } catch (err: any) {
      console.error('[API] Error eliminando archivo local de radio:', err);
      res.status(500).json({ error: err.message || 'Error al eliminar archivo local de radio' });
    }
  });

  // API upload route - Proxies to Firebase Storage via Admin SDK
  app.post('/api/upload-track', upload.fields([
    { name: 'track', maxCount: 1 },
    { name: 'cover', maxCount: 1 }
  ]), async (req: any, res: any) => {
    console.log(`[API] Triggered /api/upload-track`);
    try {
      const { userId } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      if (!userId) {
        console.error('[API] Missing userId');
        return res.status(400).json({ error: 'User ID is required' });
      }

      if (!files.track || !files.track[0]) {
        console.error('[API] Missing track file');
        return res.status(400).json({ error: 'Audio file is required' });
      }

      console.log(`[API] Starting Admin upload process for user: ${userId}`);

      // Helper to upload a file with fallback for bucket, and local disk fallback if all else fails
      const uploadWithFallback = async (filePath: string, buffer: Buffer, contentType: string) => {
        const tryBuckets = [
          firebaseConfig.storageBucket,
          `${firebaseConfig.projectId}.appspot.com`,
          firebaseConfig.projectId
        ].filter(Boolean);

        let lastError = null;
        for (const bName of tryBuckets) {
          try {
            console.log(`[API] Attempting upload to bucket: ${bName}`);
            const currentBucket = admin.storage().bucket(bName);
            const fileRef = currentBucket.file(filePath);
            
            await fileRef.save(buffer, {
              contentType,
              resumable: false,
              public: true
            });
            
            // Try to make sure it's public if it wasn't handled by save
            try { await fileRef.makePublic(); } catch (e) {}

            return `https://storage.googleapis.com/${currentBucket.name}/${filePath}`;
          } catch (err: any) {
            console.warn(`[API] Failed with bucket ${bName}: ${err.message}`);
            lastError = err;
            if (err.message.includes('bucket does not exist') || err.message.includes('permission') || err.code === 403 || err.code === 404) {
              continue;
            }
            throw err; // If it's another error, don't just try next bucket
          }
        }

        // If all bucket attempts failed, fall back to writing to local storage
        console.warn(`[API] All Firebase Storage buckets failed or do not exist. Falling back to local storage for: ${filePath}`);
        try {
          const localDestPath = path.join(process.cwd(), 'uploads', filePath);
          const localDestDir = path.dirname(localDestPath);
          
          if (!fs.existsSync(localDestDir)) {
            fs.mkdirSync(localDestDir, { recursive: true });
          }
          
          fs.writeFileSync(localDestPath, buffer);
          console.log(`[API] Local upload fallback successful: /uploads/${filePath}`);
          return `/uploads/${filePath}`;
        } catch (localErr: any) {
          console.error(`[API] Local fallback failed too:`, localErr);
          throw lastError || localErr || new Error('All upload attempts (Firebase & Local) failed');
        }
      };

      // 1. Upload Track
      const trackFile = files.track[0];
      const trackExt = trackFile.originalname.split('.').pop() || 'mp3';
      const trackPath = `tracks/${userId}/${Date.now()}.${trackExt}`;
      
      console.log(`[API] Uploading track: ${trackPath}`);
      const audioUrl = await uploadWithFallback(trackPath, trackFile.buffer, trackFile.mimetype || 'audio/mpeg');
      console.log(`[API] Audio URL generated: ${audioUrl}`);

      // 2. Upload Cover (Optional)
      let coverUrl = '';
      if (files.cover && files.cover[0]) {
        const coverFile = files.cover[0];
        const coverExt = coverFile.originalname.split('.').pop() || 'jpg';
        const coverPath = `covers/${userId}/${Date.now()}.${coverExt}`;
        
        console.log(`[API] Uploading cover: ${coverPath}`);
        coverUrl = await uploadWithFallback(coverPath, coverFile.buffer, coverFile.mimetype || 'image/jpeg');
        console.log(`[API] Cover URL generated: ${coverUrl}`);
      }

      console.log(`[API] SUCCESS: All files uploaded for ${userId}`);
      res.json({ audioUrl, coverUrl });
      
    } catch (error: any) {
      console.error('[API] CRITICAL ADMIN ERROR during upload logic:', error);
      res.status(500).json({ 
        error: error.message || 'Error interno del servidor admin',
        code: error.code || 'unknown'
      });
    }
  });

  // Custom global error handler to prevent HTML fallbacks on API errors
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[SERVER ERROR] Unhandled error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Error interno del servidor',
      code: err.code || 'UNHANDLED_ERROR',
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });
  });

  // Handle SPA and Vite
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[SERVER] Failed to start:', err);
  process.exit(1);
});
