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
  const matchingPatientsCount = chartData?.matchingPatientsCount ?? 0;

  // Cálculo de coordenadas SVG para gráfico Donut / Pie
  const size = 320;
  const center = size / 2;
  const radius = 125;
  const innerRadius = 65; // Estilo Donut elegante

  let cumulativeAngle = -Math.PI / 2; // Iniciar en las 12 en punto

  const slicePaths = slices.map((slice) => {
    const fraction = totalContacts > 0 ? Math.min(1, Math.max(0, slice.percentage / 100)) : 0;
    const angle = fraction * 2 * Math.PI;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle = endAngle;

    const isHovered = hoveredSlice === slice.id;
    const currentRadius = isHovered ? radius + 8 : radius;
    const currentInner = isHovered ? innerRadius - 4 : innerRadius;

    let pathData = '';
    if (angle >= 2 * Math.PI - 0.001) {
      // Anillo completo (100% de las emisiones en un solo canal) usando 2 arcos de 180 grados
      pathData = `
        M ${center + currentRadius} ${center}
        A ${currentRadius} ${currentRadius} 0 1 1 ${center - currentRadius} ${center}
        A ${currentRadius} ${currentRadius} 0 1 1 ${center + currentRadius} ${center}
        M ${center + currentInner} ${center}
        A ${currentInner} ${currentInner} 0 1 0 ${center - currentInner} ${center}
        A ${currentInner} ${currentInner} 0 1 0 ${center + currentInner} ${center}
        Z
      `;
    } else if (angle > 0.001) {
      const x1 = center + currentRadius * Math.cos(startAngle);
      const y1 = center + currentRadius * Math.sin(startAngle);
      const x2 = center + currentRadius * Math.cos(endAngle);
      const y2 = center + currentRadius * Math.sin(endAngle);

      const x3 = center + currentInner * Math.cos(endAngle);
      const y3 = center + currentInner * Math.sin(endAngle);
      const x4 = center + currentInner * Math.cos(startAngle);
      const y4 = center + currentInner * Math.sin(startAngle);

      const largeArcFlag = angle > Math.PI ? 1 : 0;

      pathData = `
        M ${x1} ${y1}
        A ${currentRadius} ${currentRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}
        L ${x3} ${y3}
        A ${currentInner} ${currentInner} 0 ${largeArcFlag} 0 ${x4} ${y4}
        Z
      `;
    }

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
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-5 flex flex-col justify-between transition-colors">
      {/* Cabecera con Título y Botones de Exportación */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800/60">
              <PieIcon className="w-4 h-4" />
            </span>
            <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
              Distribución de Canales de Demanda Inducida
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {matchingPatientsCount.toLocaleString('es-CO')} pacientes reales coinciden con los filtros seleccionados.
          </p>
        </div>

        {/* Acciones de Exportación (PNG y EXCEL) */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportPNG}
            disabled={isExportingPng || loading}
            className="rounded-xl bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80 font-bold text-xs gap-1.5 h-9 shadow-2xs"
            title="Exportar gráfica como imagen PNG"
          >
            <ImageIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{isExportingPng ? 'Generando...' : 'Exportar PNG'}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportExcel}
            disabled={loading}
            className="rounded-xl bg-white dark:bg-slate-800 border-emerald-300 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 font-bold text-xs gap-1.5 h-9 shadow-2xs"
            title="Exportar datos a Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
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
              {totalContacts === 0 ? (
                <circle
                  cx={center}
                  cy={center}
                  r={(radius + innerRadius) / 2}
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth={radius - innerRadius}
                  strokeDasharray="6 6"
                  className="stroke-slate-300 dark:stroke-slate-700"
                />
              ) : (
                slicePaths.map((slice) => (
                  <g key={slice.id} className="transition-all duration-200 cursor-pointer">
                    {slice.pathData && (
                      <path
                        d={slice.pathData}
                        fill={slice.color}
                        fillRule="evenodd"
                        stroke="#ffffff"
                        strokeWidth={2.5}
                        onMouseEnter={() => setHoveredSlice(slice.id)}
                        onMouseLeave={() => setHoveredSlice(null)}
                        className="stroke-white dark:stroke-slate-900 transition-all duration-200 hover:opacity-95"
                      />
                    )}
                    {slice.percentage >= 8 && (
                      <text
                        x={slice.percentage >= 99.9 ? center : slice.labelX}
                        y={slice.percentage >= 99.9 ? center - ((radius + innerRadius) / 2) : slice.labelY}
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
                ))
              )}

              {/* Centro del Donut con Total de Contactos (atributos fill para PNG y clases dark:fill para UI) */}
              <circle cx={center} cy={center} r={innerRadius - 4} fill="#ffffff" className="fill-white dark:fill-slate-900" />
              <text
                x={center}
                y={center - 8}
                textAnchor="middle"
                fontSize={10}
                fontWeight="bold"
                fill="#64748b"
                className="uppercase tracking-wider fill-slate-500 dark:fill-slate-400"
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
                className="fill-slate-900 dark:fill-white"
              >
                {totalContacts.toLocaleString('es-CO')}
              </text>
            </svg>
          </div>

          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 font-medium text-center">
            {totalContacts === 0
              ? 'Sin emisiones registradas aún para este filtro (se actualizará con tus pruebas en vivo)'
              : 'Pasa el ratón sobre cada porción para destacar el canal'}
          </span>
        </div>

        {/* Leyenda y Desglose Cuantitativo */}
        <div className="lg:col-span-5 space-y-2.5">
          <span className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 block tracking-wider mb-2">
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
                    ? 'border-slate-400 dark:border-slate-500 bg-slate-50 dark:bg-slate-800 shadow-sm scale-[1.02]'
                    : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-4 h-4 rounded-md shrink-0 shadow-2xs"
                    style={{ backgroundColor: slice.color }}
                  />
                  <div className="min-w-0">
                    <strong className="text-xs font-black text-slate-900 dark:text-white block truncate flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      {slice.label}
                    </strong>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                      {slice.count.toLocaleString('es-CO')} contactos
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-base font-black text-slate-900 dark:text-white">
                    {slice.percentage}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Resumen al pie de la gráfica */}
      <div className="bg-slate-50 dark:bg-slate-800/70 rounded-xl p-3 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-600 dark:text-slate-300 gap-2">
        <div className="flex items-center gap-1.5 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            {totalContacts > 0 ? (
              <>Canal de Mayor Demanda: <strong className="text-slate-900 dark:text-white">{slices[0]?.label || 'Llamada'} ({slices[0]?.percentage}%)</strong></>
            ) : (
              <>Sin emisiones multicanal todavía • <strong className="text-slate-900 dark:text-white">{matchingPatientsCount} pacientes reales en rango</strong></>
            )}
          </span>
        </div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">
          * Datos reales consultados en Supabase
        </div>
      </div>
    </div>
  );
}

