// ==============================================================================
// InteractivePieChart.jsx - GRÁFICA DE TORTA INTERACTIVA Y EXPORTABLE (PNG / EXCEL)
// Muestra el porcentaje de uso de los canales de demanda (Llamada, WhatsApp, E-mail, SMS)
// Permite exportar directamente como imagen PNG en alta resolución y como Excel (.xlsx).
// ==============================================================================

import React, { useRef, useState } from 'react';
import { 
  Download, 
  Image as ImageIcon, 
  FileSpreadsheet, 
  Phone, 
  MessageSquare, 
  Mail, 
  Send,
  PieChart as PieIcon,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { reportsAnalysisService } from '@/services/reportsAnalysisService';

export default function InteractivePieChart({
  chartData,
  filterLabels = {},
  loading = false
}) {
  const { toast } = useToast();
  const svgRef = useRef(null);
  const [hoveredSlice, setHoveredSlice] = useState(null);
  const [isExportingPng, setIsExportingPng] = useState(false);

  const slices = chartData?.slices || [];
  const totalContacts = chartData?.totalContacts || 0;

  // Cálculo de coordenadas SVG para gráfico Donut / Pie
  const size = 320;
  const center = size / 2;
  const radius = 125;
  const innerRadius = 65; // Estilo Donut elegante

  let cumulativeAngle = -Math.PI / 2; // Iniciar en las 12 en punto

  const slicePaths = slices.map((slice) => {
    const angle = (slice.percentage / 100) * 2 * Math.PI;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle = endAngle;

    const isHovered = hoveredSlice === slice.id;
    const currentRadius = isHovered ? radius + 8 : radius;
    const currentInner = isHovered ? innerRadius - 4 : innerRadius;

    // Coordenadas exteriores
    const x1 = center + currentRadius * Math.cos(startAngle);
    const y1 = center + currentRadius * Math.sin(startAngle);
    const x2 = center + currentRadius * Math.cos(endAngle);
    const y2 = center + currentRadius * Math.sin(endAngle);

    // Coordenadas interiores
    const x3 = center + currentInner * Math.cos(endAngle);
    const y3 = center + currentInner * Math.sin(endAngle);
    const x4 = center + currentInner * Math.cos(startAngle);
    const y4 = center + currentInner * Math.sin(startAngle);

    const largeArcFlag = angle > Math.PI ? 1 : 0;

    const pathData = `
      M ${x1} ${y1}
      A ${currentRadius} ${currentRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}
      L ${x3} ${y3}
      A ${currentInner} ${currentInner} 0 ${largeArcFlag} 0 ${x4} ${y4}
      Z
    `;

    // Posición del label de porcentaje en el centro del arco
    const midAngle = (startAngle + endAngle) / 2;
    const labelRadius = (currentRadius + currentInner) / 2;
    const labelX = center + labelRadius * Math.cos(midAngle);
    const labelY = center + labelRadius * Math.sin(midAngle);

    return {
      ...slice,
      pathData,
      labelX,
      labelY,
      isHovered
    };
  });

  // Exportar Gráfica como Imagen PNG mediante HTML5 Canvas en alta resolución
  const handleExportPNG = () => {
    try {
      setIsExportingPng(true);
      const svgElement = svgRef.current;
      if (!svgElement) return;

      const canvas = document.createElement('canvas');
      const scale = 2; // 2x para resolución retina
      const width = 640;
      const height = 640;
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);

      // Fondo blanco institucional
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Encabezado del reporte en la imagen
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 18px Inter, system-ui, sans-serif';
      ctx.fillText('Hospital SADI - Distribución de Canales de Demanda', 30, 40);

      ctx.fillStyle = '#64748b';
      ctx.font = '12px Inter, system-ui, sans-serif';
      const subtitle = `Filtros: ${filterLabels.cursoVida || 'Todos'} • ${filterLabels.zona || 'Todas'} • ${filterLabels.barrio || 'Todos'}`;
      ctx.fillText(subtitle, 30, 62);
      ctx.fillText(`Total Contactos: ${totalContacts.toLocaleString('es-CO')} | ${new Date().toLocaleDateString('es-CO')}`, 30, 80);

      // Convertir SVG a imagen
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);
      const image = new Image();

      image.onload = () => {
        // Dibujar el gráfico centrado
        ctx.drawImage(image, (width - size) / 2, 100, size, size);

        // Dibujar leyenda debajo
        let legendY = 460;
        slices.forEach((s) => {
          ctx.fillStyle = s.color;
          ctx.beginPath();
          ctx.roundRect(50, legendY - 10, 16, 16, 4);
          ctx.fill();

          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 13px Inter, system-ui, sans-serif';
          ctx.fillText(`${s.label}: ${s.percentage}% (${s.count.toLocaleString('es-CO')} contactos)`, 75, legendY + 3);
          legendY += 26;
        });

        // Pie de autoría
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.fillText('Generado por SADI - Sistema de Demanda Inducida (Resolución 3280)', 30, 610);

        // Descargar PNG
        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `Grafica_Torta_Canales_SADI_${new Date().toISOString().split('T')[0]}.png`;
        link.href = pngUrl;
        link.click();
        URL.revokeObjectURL(blobURL);

        toast({
          title: '📷 Imagen PNG Exportada',
          description: 'La gráfica de torta se ha descargado exitosamente en alta resolución.',
          className: 'bg-emerald-600 text-white font-bold'
        });
        setIsExportingPng(false);
      };

      image.onerror = () => {
        setIsExportingPng(false);
        throw new Error('Fallo al renderizar el SVG a Canvas.');
      };

      image.src = blobURL;
    } catch (e) {
      setIsExportingPng(false);
      console.error('Error exportando PNG:', e);
      toast({
        title: 'Error al exportar PNG',
        description: e.message || 'No se pudo generar la imagen.',
        variant: 'destructive'
      });
    }
  };

  // Exportar a Excel
  const handleExportExcel = () => {
    try {
      const fileName = reportsAnalysisService.exportPieChartToExcel({
        chartData,
        filterLabels
      });
      toast({
        title: '📊 Archivo Excel Exportado',
        description: `Se ha generado el archivo "${fileName}" con el desglose de canales y filtros.`,
        className: 'bg-emerald-600 text-white font-bold'
      });
    } catch (e) {
      console.error('Error exportando Excel:', e);
      toast({
        title: 'Error al exportar Excel',
        description: e.message || 'No se pudo generar el libro de Excel.',
        variant: 'destructive'
      });
    }
  };

  const getChannelIcon = (id) => {
    switch (id) {
      case 'call': return Phone;
      case 'whatsapp': return Send;
      case 'email': return Mail;
      case 'sms': return MessageSquare;
      default: return PieIcon;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 flex flex-col justify-between">
      {/* Cabecera con Título y Botones de Exportación */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
              <PieIcon className="w-4 h-4" />
            </span>
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              Distribución de Canales de Demanda Inducida
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Porcentaje de uso según los filtros territoriales y clínicos seleccionados.
          </p>
        </div>

        {/* Acciones de Exportación (PNG y EXCEL) */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportPNG}
            disabled={isExportingPng || loading}
            className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs gap-1.5 h-9 shadow-2xs"
            title="Exportar gráfica como imagen PNG"
          >
            <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>{isExportingPng ? 'Generando...' : 'Exportar PNG'}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportExcel}
            disabled={loading}
            className="rounded-xl border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold text-xs gap-1.5 h-9 shadow-2xs"
            title="Exportar datos a Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Exportar Excel</span>
          </Button>
        </div>
      </div>

      {/* Cuerpo Central: Gráfica SVG + Leyenda Desglosada */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center py-6">
        {/* Gráfico de Torta SVG Vectorial */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center relative">
          <div className="relative">
            <svg
              ref={svgRef}
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="overflow-visible filter drop-shadow-xs"
            >
              {slicePaths.map((slice) => (
                <g key={slice.id} className="transition-all duration-200 cursor-pointer">
                  <path
                    d={slice.pathData}
                    fill={slice.color}
                    stroke="#ffffff"
                    strokeWidth={2.5}
                    onMouseEnter={() => setHoveredSlice(slice.id)}
                    onMouseLeave={() => setHoveredSlice(null)}
                    className="transition-all duration-200 hover:opacity-95"
                  />
                  {slice.percentage >= 8 && (
                    <text
                      x={slice.labelX}
                      y={slice.labelY}
                      fill="#ffffff"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={slice.isHovered ? 13 : 11}
                      fontWeight="bold"
                      pointerEvents="none"
                      className="drop-shadow-sm font-sans"
                    >
                      {slice.percentage}%
                    </text>
                  )}
                </g>
              ))}

              {/* Centro del Donut con Total de Contactos */}
              <circle cx={center} cy={center} r={innerRadius - 4} fill="#ffffff" />
              <text
                x={center}
                y={center - 8}
                textAnchor="middle"
                fontSize={10}
                fontWeight="bold"
                fill="#64748b"
                className="uppercase tracking-wider"
              >
                Contactos
              </text>
              <text
                x={center}
                y={center + 14}
                textAnchor="middle"
                fontSize={16}
                fontWeight="900"
                fill="#0f172a"
              >
                {totalContacts.toLocaleString('es-CO')}
              </text>
            </svg>
          </div>

          <span className="text-[11px] text-slate-400 mt-2 font-medium">
            Pasa el ratón sobre cada porción para destacar el canal
          </span>
        </div>

        {/* Leyenda y Desglose Cuantitativo */}
        <div className="lg:col-span-5 space-y-2.5">
          <span className="text-[11px] font-black uppercase text-slate-400 block tracking-wider mb-2">
            Desglose por Canal de Contacto:
          </span>

          {slices.map((slice) => {
            const Icon = getChannelIcon(slice.id);
            const isHovered = hoveredSlice === slice.id;

            return (
              <div
                key={slice.id}
                onMouseEnter={() => setHoveredSlice(slice.id)}
                onMouseLeave={() => setHoveredSlice(null)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isHovered
                    ? 'border-slate-400 bg-slate-50 shadow-sm scale-[1.02]'
                    : 'border-slate-200/80 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-4 h-4 rounded-md shrink-0 shadow-2xs"
                    style={{ backgroundColor: slice.color }}
                  />
                  <div className="min-w-0">
                    <strong className="text-xs font-black text-slate-900 block truncate flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-slate-500" />
                      {slice.label}
                    </strong>
                    <span className="text-[11px] text-slate-500 block">
                      {slice.count.toLocaleString('es-CO')} contactos
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-base font-black text-slate-900">
                    {slice.percentage}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Resumen al pie de la gráfica */}
      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
        <div className="flex items-center gap-1.5 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Canal de Mayor Demanda: <strong>{slices[0]?.label || 'Llamada'} ({slices[0]?.percentage}%)</strong></span>
        </div>
        <div className="text-[11px] text-slate-400 font-semibold">
          * Datos sincronizados con el Censo Territorial SADI
        </div>
      </div>
    </div>
  );
}

