import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Select } from '@mantine/core';
import { IconReload, IconCameraOff, IconCameraDown, IconRefresh } from '@tabler/icons-react';
import './CameraWindow.css';

// Camera window component for image capture functionality
const CameraWindow: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const initializingRef = useRef<boolean>(false);
  
  // Camera state management
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isVideoReady, setIsVideoReady] = useState<boolean>(false);

  // Stop current video stream and clean up resources
  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsVideoReady(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  // Start camera stream with specified device ID and 1080p resolution
  const startCameraStream = useCallback(async (deviceId: string) => {
    console.log('Starting camera stream for device:', deviceId);
    stopStream();
    setError(null);
    setIsVideoReady(false);

    // Configure camera constraints for optimal quality
    const constraints: MediaStreamConstraints = {
      video: {
        deviceId: { exact: deviceId },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    };

    try {
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Camera stream started successfully');
      setStream(newStream);

      const videoTrack = newStream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      console.log(`Camera resolution: ${settings.width}x${settings.height}`);
      
      setLoading(false);
    } catch (err: any) {
      console.error(`Error starting camera stream:`, err);
      setError(`Failed to start camera: ${err.message}`);
      setStream(null);
      setIsVideoReady(false);
      setLoading(false);
    }
  }, [stopStream]);

  // Enumerate available camera devices and start first one
  const getCameraDevices = useCallback(async () => {
    if (initializingRef.current) {
      console.log('Already initializing, skipping...');
      return;
    }
    
    initializingRef.current = true;
    setLoading(true);
    setIsVideoReady(false);
    
    try {
      // Request permission first to get device labels
      await navigator.mediaDevices.getUserMedia({ video: true });
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter((device) => device.kind === 'videoinput');

      console.log('Available cameras:', videoDevices);
      setCameraDevices(videoDevices);
      setError(null);

      // Auto-select and start first available camera
      if (videoDevices.length > 0) {
        const firstCamera = videoDevices[0].deviceId;
        setSelectedCameraId(firstCamera);
        await startCameraStream(firstCamera);
      }
    } catch (err: any) {
      console.error('Error getting camera devices:', err);
      setError(`Cannot access cameras: ${err.message}. Check permissions.`);
      setCameraDevices([]);
      setLoading(false);
    } finally {
      initializingRef.current = false;
    }
  }, [startCameraStream]);

  // Set up video element with stream and handle multiple play events for reliability
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) {
      setIsVideoReady(false);
      return;
    }

    console.log('Setting up video with stream');
    setIsVideoReady(false);

    let videoReadySet = false;

    // Helper to prevent multiple ready state sets
    const setVideoReady = () => {
      if (!videoReadySet) {
        console.log('Setting video ready to true');
        videoReadySet = true;
        setIsVideoReady(true);
      }
    };

    // Video event handlers for reliable playback across browsers
    const handleLoadedMetadata = () => {
      console.log('Video metadata loaded');
      video.play().then(() => {
        console.log('Video play() succeeded');
        setVideoReady();
      }).catch(e => {
        console.error('Video play() failed:', e);
        setError('Failed to play video stream');
      });
    };

    const handleCanPlay = () => {
      console.log('Video can play');
      if (!videoReadySet) {
        video.play().then(() => {
          console.log('Video play() succeeded from canplay');
          setVideoReady();
        }).catch(e => {
          console.error('Video play() failed from canplay:', e);
        });
      }
    };

    const handlePlaying = () => {
      console.log('Video is playing');
      setVideoReady();
    };

    const handleTimeUpdate = () => {
      if (!videoReadySet) {
        console.log('Video time update - setting ready to true');
        setVideoReady();
      }
    };

    // Register all video event listeners
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('timeupdate', handleTimeUpdate);

    video.srcObject = stream;

    // Try immediate play if video is ready
    if (video.readyState >= 2) {
      console.log('Video readyState >= 2, attempting immediate play');
      video.play().then(() => {
        console.log('Immediate play succeeded');
        setVideoReady();
      }).catch(e => {
        console.error('Immediate play failed:', e);
      });
    }

    // Fallback timer to force play if other events don't fire
    const checkTimer = setTimeout(() => {
      if (video.readyState >= 2 && !videoReadySet) {
        console.log('Timer check: forcing video play');
        video.play().then(() => {
          console.log('Timer play succeeded');
          setVideoReady();
        }).catch(e => {
          console.error('Timer play failed:', e);
        });
      }
    }, 500);

    // Cleanup event listeners and timer
    return () => {
      clearTimeout(checkTimer);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [stream]);

  // Capture photo from video stream and auto-download with timestamp filename
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !stream || !isVideoReady) {
      console.error('No video stream available or video not ready');
      return;
    }

    try {
      // Create canvas with video dimensions
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const photoData = canvas.toDataURL('image/jpeg');
        
        // Download photo
        const link = document.createElement('a');
        link.href = photoData;
        const now = new Date();
        const fileName = `photo_${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}-${now.getSeconds().toString().padStart(2, '0')}.jpg`;
        link.download = fileName;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('Photo captured and downloaded');
      }
    } catch (err) {
      console.error('Error capturing photo:', err);
    }
  }, [stream, isVideoReady]);

  // Initialize camera devices on component mount
  useEffect(() => {
    let mounted = true;
    
    const initCamera = async () => {
      if (mounted) {
        await getCameraDevices();
      }
    };
    
    initCamera();
    
    return () => {
      mounted = false;
    };
  }, []);

  // Cleanup stream when component unmounts
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  // Handle camera selection change
  const handleCameraChange = (value: string | null) => {
    if (value && value !== selectedCameraId) {
      console.log('Camera changed to:', value);
      setSelectedCameraId(value);
      initializingRef.current = false;
      startCameraStream(value);
    }
  };

  // Refresh camera device list and reset state
  const handleRefreshCameras = () => {
    console.log('Refreshing cameras...');
    initializingRef.current = false;
    
    stopStream();
    
    setCameraDevices([]);
    setSelectedCameraId("");
    setError(null);
    setLoading(true);
    setIsVideoReady(false);
    
    getCameraDevices();
  };

  return (
    <div className="camera-window">
      {/* Black header bar with camera controls */}
      <div className="camera-header">
        <div className="camera-controls">
          {/* Camera selection dropdown with platform-specific naming */}
          <Select
            data={cameraDevices.map(device => ({ 
              value: device.deviceId, 
              label: device.label || 
                (process.platform === 'linux' ? `Camera ${device.deviceId.slice(-8)}` :
                process.platform === 'darwin' ? `Camera ${device.deviceId.slice(-8)}` :
                `Camera ${device.deviceId.slice(-4)}`)
            }))}
            value={selectedCameraId}
            onChange={handleCameraChange}
            placeholder="Select camera"
            size="sm"
            style={{ minWidth: '250px' }}
            styles={{
              input: { 
                backgroundColor: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white'
              },
              dropdown: {
                backgroundColor: '#333',
                border: '1px solid #555'
              },
              option: {
                color: 'white',
                '&[data-selected]': {
                  backgroundColor: '#555'
                },
                '&:hover': {
                  backgroundColor: '#444'
                }
              }
            }}
          />

          {/* Refresh cameras button */}
          <Button 
            onClick={handleRefreshCameras}
            variant="filled"
            color="dark"
            size="sm"
            style={{ 
              width: '36px',
              height: '36px',
              padding: 0,
              backgroundColor: '#000000',
              border: '1px solid rgba(255,255,255,0.3)'
            }}
            styles={{
              root: {
                '&:hover': {
                  backgroundColor: '#333333'
                }
              }
            }}
          >
            <IconRefresh size={16} color="white" />
          </Button>

          {/* Photo capture button */}
          <Button
            onClick={capturePhoto}
            variant="filled"
            color="dark"
            size="sm"
            disabled={!stream || !isVideoReady}
            style={{
              width: '36px',
              height: '36px',
              padding: 0,
              backgroundColor: '#000000',
              border: '1px solid rgba(255,255,255,0.3)'
            }}
            styles={{
              root: {
                '&:hover': {
                  backgroundColor: '#333333'
                },
                '&:disabled': {
                  backgroundColor: '#666666',
                  opacity: 0.5
                }
              }
            }}
          >
            <IconCameraDown size={16} color="white" />
          </Button>
        </div>
      </div>
      
      {/* Camera preview area */}
      <div className="camera-content">
        <div className="camera-video-container">
          {/* Main video element - hidden until ready */}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="camera-video"
            style={{ 
              display: isVideoReady ? 'block' : 'none',
              backgroundColor: 'transparent'
            }}
          />
          
          {/* Error state overlay */}
          {error && (
            <div className="camera-overlay">
              <IconCameraOff size={48} color="#999" />
              <p>{error}</p>
            </div>
          )}

          {/* Loading state overlay */}
          {loading && (
            <div className="camera-overlay">
              <IconReload size={48} color="#333" className="loading-icon" />
              <p>Initializing camera...</p>
            </div>
          )}

          {/* No cameras detected overlay */}
          {!loading && !stream && cameraDevices.length === 0 && !error && (
            <div className="camera-overlay">
              <IconCameraOff size={48} color="#999" />
              <p>No cameras detected</p>
            </div>
          )}

          {/* Starting stream overlay */}
          {!loading && stream && !isVideoReady && !error && (
            <div className="camera-overlay">
              <IconReload size={48} color="#333" className="loading-icon" />
              <p>Starting video stream...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraWindow;