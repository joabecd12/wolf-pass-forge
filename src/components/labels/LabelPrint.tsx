import React, { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import QRCode from "qrcode";

interface Participant {
  id: string;
  name: string;
  category: string;
}

interface LabelPrintProps {
  participant: Participant;
  onClose?: () => void;
}

export const LabelPrint: React.FC<LabelPrintProps> = ({ participant, onClose }) => {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const generateQR = async () => {
      try {
        const validationUrl = `https://validapass.com.br/validar?id=${participant.id}`;
        
        // Generate QR code as base64 data URL
        const qrDataUrl = await QRCode.toDataURL(validationUrl, {
          width: 80,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        
        // Insert QR code as image in the container
        const qrContainer = document.getElementById('qr-image');
        if (qrContainer) {
          qrContainer.innerHTML = `<img src="${qrDataUrl}" style="width: 80px; height: 80px;" alt="QR Code" />`;
        }
        
        // Also update canvas for fallback
        if (qrCanvasRef.current) {
          await QRCode.toCanvas(qrCanvasRef.current, validationUrl, {
            width: 80,
            margin: 1,
          });
        }
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    };
    generateQR();
  }, [participant.id]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="label-container">
      {/* Print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .label-container,
          .label-container * {
            visibility: visible;
          }
          .label-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 90mm;
            height: 29mm;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Print Button - hidden during print */}
      <div className="no-print mb-4 flex gap-2">
        <Button onClick={handlePrint} className="flex items-center gap-2">
          <Printer className="h-4 w-4" />
          Imprimir Etiqueta
        </Button>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        )}
      </div>

      {/* Label Content */}
      <div 
        className="label-content bg-white border-2 border-gray-300 p-2 rounded-lg"
        style={{
          width: "90mm",
          height: "29mm",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          fontFamily: "Arial, sans-serif",
          color: "black",
          fontSize: "10px"
        }}
      >
        {/* Left side - Event name and Participant info */}
        <div className="flex-1 pr-2">
          <div className="mb-1">
            <div className="text-xs font-bold text-black">WOLF DAY BRAZIL</div>
          </div>
          
          <div className="mb-1">
            <div className="text-xs font-semibold text-black break-words">
              {participant.name}
            </div>
          </div>
          
          <div className="mb-1">
            <div className="text-xs text-black">
              {participant.category}
            </div>
          </div>

          <div>
            <div className="text-xs font-mono text-black">
              ID: {participant.id ? participant.id.substring(0, 8).toUpperCase() : 'N/A'}
            </div>
          </div>
        </div>

        {/* Right side - QR Code */}
        <div className="flex items-center justify-center">
          <canvas ref={qrCanvasRef} style={{ display: 'none' }} />
          <div id="qr-image" className="qr-code-container">
            {/* QR Code will be inserted here as image */}
          </div>
        </div>
      </div>
    </div>
  );
};

// Utility function to open label in new window for printing
export const printLabel = async (participant: Participant) => {
  try {
    // Generate QR code as base64 first
    const validationUrl = `https://validapass.com.br/validar?id=${participant.id}`;
    const qrDataUrl = await QRCode.toDataURL(validationUrl, {
      width: 70,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    const printWindow = window.open("", "_blank", "width=400,height=300");
    
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Etiqueta - ${participant.name}</title>
            <link rel="icon" href="/lovable-uploads/6f306e0d-afed-4059-8f01-8f745bae3aa0.png" type="image/png">
            <link rel="apple-touch-icon" href="/lovable-uploads/6f306e0d-afed-4059-8f01-8f745bae3aa0.png">
            <meta name="msapplication-TileImage" content="/lovable-uploads/6f306e0d-afed-4059-8f01-8f745bae3aa0.png">
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              html, body {
                margin: 0;
                padding: 0;
                font-family: Arial, sans-serif;
              }
              
              @page {
                size: 90mm 29mm;
                margin: 0;
              }
              
              @media print {
                html, body {
                  margin: 0;
                  padding: 0;
                  width: 90mm;
                  height: 29mm;
                }
                
                .etiqueta {
                  width: 90mm;
                  height: 29mm;
                  margin: 0;
                  padding: 0;
                }
              }
              
              .etiqueta {
                width: 90mm;
                height: 29mm;
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 4mm;
                box-sizing: border-box;
                background: white;
                border: none;
              }
              
              .info {
                flex: 1;
                display: flex;
                flex-direction: column;
                justify-content: center;
                padding-right: 4mm;
              }
              
              .event-title {
                font-size: 10pt;
                font-weight: bold;
                color: #333;
                margin-bottom: 1mm;
              }
              
              .participant-name {
                font-size: 16pt;
                font-weight: bold;
                color: #000;
                margin-bottom: 1mm;
                line-height: 1.1;
                word-wrap: break-word;
              }
              
              .participant-category {
                font-size: 9pt;
                color: #666;
                margin-bottom: 1mm;
              }
              
              .participant-id {
                font-size: 8pt;
                font-family: monospace;
                color: #666;
              }
              
              .qr-section {
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              
              .qr-section img {
                width: 20mm;
                height: 20mm;
                display: block;
              }
            </style>
          </head>
          <body>
            <div class="etiqueta">
              <div class="info">
                <div class="event-title">WOLF DAY BRAZIL</div>
                <div class="participant-name">${participant.name}</div>
                <div class="participant-category">${participant.category}</div>
                <div class="participant-id">ID: ${participant.id ? participant.id.substring(0, 8).toUpperCase() : 'N/A'}</div>
              </div>
              
              <div class="qr-section">
                <img src="${qrDataUrl}" alt="QR Code" />
              </div>
            </div>
            
            <script>
              // Auto print after page loads
              setTimeout(() => {
                window.print();
              }, 100);
            </script>
          </body>
        </html>
      `);
      
      printWindow.document.close();
    }
  } catch (error) {
    console.error('Error generating QR code for print:', error);
  }
};