/**
 * ImageCropper - Modal para recortar imágenes (para avatares)
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Modal, Button } from '../';
import { ZoomIn, ZoomOut, RotateCcw, Check, X } from 'lucide-react';
import styles from './ImageCropper.module.css';

const ImageCropper = ({ 
  isOpen, 
  onClose, 
  imageFile, 
  onCropComplete,
  aspectRatio = 1, // 1:1 para avatar
  cropShape = 'round' // 'round' | 'rect'
}) => {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState('');
  const [processing, setProcessing] = useState(false);

  // Cargar imagen cuando se abre
  useEffect(() => {
    if (imageFile && isOpen) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageSrc(e.target.result);
        setScale(1);
        setPosition({ x: 0, y: 0 });
        setImageLoaded(false);
      };
      reader.readAsDataURL(imageFile);
    } else if (!isOpen) {
      // Resetear cuando se cierra
      setImageSrc('');
      setImageLoaded(false);
    }
  }, [imageFile, isOpen]);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    });
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    });
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.1, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.1, 0.5));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleCrop = async () => {
    if (!imageRef.current || !canvasRef.current) return;

    setProcessing(true);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;

    // Tamaño del crop final (300x300 para avatares de alta calidad)
    const cropSize = 300;
    canvas.width = cropSize;
    canvas.height = cropSize;

    // Dimensiones del contenedor y área de crop visible
    const containerSize = 250; // Tamaño del contenedor
    const cropAreaSize = 200; // Tamaño del área de crop (cuadrado visible)
    
    const imgRatio = img.naturalWidth / img.naturalHeight;
    
    // Calcular dimensiones de visualización de la imagen
    let displayWidth, displayHeight;
    if (imgRatio > 1) {
      // Imagen horizontal: ajustar altura al contenedor
      displayHeight = containerSize;
      displayWidth = containerSize * imgRatio;
    } else {
      // Imagen vertical: ajustar ancho al contenedor
      displayWidth = containerSize;
      displayHeight = containerSize / imgRatio;
    }

    // Aplicar escala
    displayWidth *= scale;
    displayHeight *= scale;

    // El centro del contenedor
    const containerCenterX = containerSize / 2;
    const containerCenterY = containerSize / 2;
    
    // La posición actual del centro de la imagen en el contenedor
    // La imagen está centrada inicialmente, y position.x/y es el offset desde ese centro
    const imageCenterX = containerCenterX + position.x;
    const imageCenterY = containerCenterY + position.y;
    
    // Calcular qué porción de la imagen natural corresponde al área de crop
    // El área de crop está centrada en el contenedor
    const cropLeft = containerCenterX - cropAreaSize / 2;
    const cropTop = containerCenterY - cropAreaSize / 2;
    
    // Calcular la posición relativa del crop respecto a la imagen mostrada
    // La imagen mostrada tiene su centro en (imageCenterX, imageCenterY)
    const imageLeft = imageCenterX - displayWidth / 2;
    const imageTop = imageCenterY - displayHeight / 2;
    
    // Offset del crop dentro de la imagen mostrada
    const relCropLeft = cropLeft - imageLeft;
    const relCropTop = cropTop - imageTop;
    
    // Convertir a coordenadas de la imagen natural
    const scaleToNatural = img.naturalWidth / displayWidth;
    const srcX = relCropLeft * scaleToNatural;
    const srcY = relCropTop * (img.naturalHeight / displayHeight);
    const srcWidth = cropAreaSize * scaleToNatural;
    const srcHeight = cropAreaSize * (img.naturalHeight / displayHeight);

    // Limpiar canvas
    ctx.clearRect(0, 0, cropSize, cropSize);

    // Si es redondo, crear máscara circular
    if (cropShape === 'round') {
      ctx.beginPath();
      ctx.arc(cropSize / 2, cropSize / 2, cropSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
    }

    // Dibujar imagen recortada
    ctx.drawImage(
      img,
      srcX, srcY, srcWidth, srcHeight,
      0, 0, cropSize, cropSize
    );

    // Convertir a blob
    canvas.toBlob(async (blob) => {
      if (blob) {
        // Crear archivo desde blob
        const croppedFile = new File([blob], imageFile?.name || 'avatar.jpg', {
          type: 'image/jpeg'
        });
        onCropComplete(croppedFile);
      }
      setProcessing(false);
      onClose();
    }, 'image/jpeg', 0.9);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ajustar foto de perfil"
      size="sm"
    >
      <div className={styles.cropperContainer}>
        <div 
          ref={containerRef}
          className={styles.imageContainer}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
        >
          {imageSrc && (
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Preview"
              className={styles.previewImage}
              style={{
                transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${scale})`,
                cursor: isDragging ? 'grabbing' : 'grab'
              }}
              onLoad={handleImageLoad}
              draggable={false}
            />
          )}
          <div className={`${styles.cropOverlay} ${cropShape === 'round' ? styles.round : ''}`}>
            <div className={styles.cropArea}></div>
          </div>
        </div>

        <div className={styles.controls}>
          <button 
            className={styles.controlBtn} 
            onClick={handleZoomOut}
            title="Alejar"
          >
            <ZoomOut size={20} />
          </button>
          
          <div className={styles.zoomIndicator}>
            {Math.round(scale * 100)}%
          </div>
          
          <button 
            className={styles.controlBtn} 
            onClick={handleZoomIn}
            title="Acercar"
          >
            <ZoomIn size={20} />
          </button>
          
          <button 
            className={styles.controlBtn} 
            onClick={handleReset}
            title="Reiniciar"
          >
            <RotateCcw size={20} />
          </button>
        </div>

        <p className={styles.hint}>
          Arrastra para mover la imagen y usa los controles para ajustar el zoom
        </p>

        <div className={styles.actions}>
          <Button 
            variant="secondary" 
            onClick={onClose}
            icon={<X size={18} />}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleCrop}
            loading={processing}
            icon={<Check size={18} />}
          >
            Aplicar
          </Button>
        </div>
      </div>

      {/* Canvas oculto para procesamiento */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </Modal>
  );
};

export default ImageCropper;
