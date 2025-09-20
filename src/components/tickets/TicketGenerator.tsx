import QRCode from "qrcode";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface Participant {
  id: string;
  name: string;
  email: string;
  category: string;
}

export class TicketGenerator {
  static async generateAndDownload(participant: Participant, qrCodeData: string) {
    try {
      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(qrCodeData, {
        width: 200,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      // Create ticket HTML
      const ticketHtml = this.createTicketHTML(participant, qrCodeUrl);
      
      // Create temporary element
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = ticketHtml;
      tempDiv.style.position = "absolute";
      tempDiv.style.left = "-9999px";
      tempDiv.style.top = "-9999px";
      document.body.appendChild(tempDiv);

      // Generate canvas
      const canvas = await html2canvas(tempDiv.firstElementChild as HTMLElement, {
        width: 800,
        height: 450,
        backgroundColor: "#ffffff",
        scale: 2,
      });

      // Clean up
      document.body.removeChild(tempDiv);

      // Convert to PDF
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("l", "mm", [210, 118]); // Landscape, ticket size ligeiramente maior
      pdf.addImage(imgData, "PNG", 0, 0, 210, 118);
      
      // Download
      pdf.save(`ingresso-${participant.name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    } catch (error) {
      console.error("Error generating ticket:", error);
      throw error;
    }
  }

  private static createTicketHTML(participant: Participant, qrCodeUrl: string): string {
    const getCategoryColor = (category: string) => {
      switch (category) {
        case "Wolf Gold":
          return "#FFA500";
        case "Wolf Black":
          return "#262626";
        case "VIP Wolf":
          return "#B347E6";
        default:
          return "#666666";
      }
    };

    const categoryColor = getCategoryColor(participant.category);

    const escape = (s: string) => String(s).replace(/[&<>"'`=\\/]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;' } as Record<string, string>)[c] || c);
    const safeName = escape(participant.name);
    const safeEmail = escape(participant.email);
    const safeCategory = escape(participant.category);

    return `
      <div style="
        width: 800px;
        height: 450px;
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        border: 3px solid ${categoryColor};
        border-radius: 12px;
        display: flex;
        font-family: 'Arial', sans-serif;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
      ">
        <!-- Left side - Event info -->
        <div style="
          flex: 2;
          padding: 40px;
          background: linear-gradient(135deg, #262626 0%, #404040 100%);
          color: white;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        ">
          <div>
            <h1 style="
              font-size: 48px;
              font-weight: bold;
              margin: 0 0 10px 0;
              color: ${categoryColor};
              text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            ">🐺 WOLF DAY</h1>
            <h2 style="
              font-size: 32px;
              font-weight: bold;
              margin: 0 0 30px 0;
              color: white;
            ">BRAZIL 2025</h2>
            
            <div style="
              background: ${categoryColor};
              color: ${participant.category === 'Wolf Gold' ? '#000' : '#fff'};
              padding: 12px 24px;
              border-radius: 25px;
              font-size: 20px;
              font-weight: bold;
              text-align: center;
              margin-bottom: 30px;
              text-transform: uppercase;
            ">${safeCategory}</div>
          </div>
          
          <div style="color: #cccccc; font-size: 14px; line-height: 1.8;">
            <div style="margin-bottom: 4px;"><strong>📅 Data:</strong> 24 e 25 de setembro de 2025</div>
            <div style="margin-bottom: 4px;"><strong>🕒 Horário:</strong> 08h às 20h</div>
            <div style="margin-bottom: 4px;"><strong>📍 Local:</strong> Vibra São Paulo – Av. das Nações Unidas, 17955</div>
            <div style="margin-bottom: 4px;"><strong>🏙️ Cidade:</strong> São Paulo – SP</div>
            <div><strong>🎫 Ingresso:</strong> ${participant.id.slice(0, 8).toUpperCase()}</div>
          </div>
        </div>
        
        <!-- Right side - Participant info and QR -->
        <div style="
          flex: 1;
          padding: 40px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
          text-align: center;
        ">
          <div style="width: 100%;">
            <h3 style="
              font-size: 18px;
              font-weight: bold;
              margin: 0 0 20px 0;
              color: #333;
              text-transform: uppercase;
              letter-spacing: 1px;
            ">Participante</h3>
            
            <div style="
              font-size: ${participant.name.length > 25 ? '20px' : '24px'};
              font-weight: bold;
              color: ${categoryColor};
              margin-bottom: 10px;
              word-wrap: break-word;
              word-break: break-word;
              hyphens: auto;
              line-height: 1.2;
              max-width: 100%;
              overflow-wrap: break-word;
            ">${safeName}</div>
            
            <div style="
              font-size: 14px;
              color: #666;
              margin-bottom: 30px;
              word-wrap: break-word;
            ">${safeEmail}</div>
          </div>
          
          <div style="text-align: center;">
            <img src="${qrCodeUrl}" style="
              width: 140px;
              height: 140px;
              border: 2px solid #eee;
              border-radius: 8px;
              margin-bottom: 10px;
            " />
            <div style="
              font-size: 11px;
              color: #999;
              line-height: 1.3;
            ">
              Apresente este QR Code<br/>
              na entrada do evento
            </div>
          </div>
        </div>
      </div>
    `;
  }
}