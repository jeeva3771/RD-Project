import express from "express";
import upload from "../../middleware/multer.js";
import { deleteImage, downloadImage, uploadTest, viewImage } from "../../controllers/R2/r2Controller.js";

const router = express.Router();

router.post('/upload-test', upload.array('images', 10), uploadTest);

router.get('/download', downloadImage);
router.get('/view', viewImage); 
router.delete('/delete', deleteImage); 


export default router;




