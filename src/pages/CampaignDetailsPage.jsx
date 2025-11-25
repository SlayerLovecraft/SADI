import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Send, Users, Clock, CheckCircle } from 'lucide-react';

const CampaignDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('sadi_campaigns');
    if (stored) {
      const campaigns = JSON.parse(stored);
      const found = campaigns.find(c => c.id === id);
      setCampaign(found);
    }
  }, [id]);

  if (!campaign) {
    return (
      <Layout>
        <div className="p-8 text-center">Cargando o campaña no encontrada...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Detalles de Campaña - SADI</title>
      </Helmet>
      
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/campaigns')} className="mb-4 pl-0">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a Campañas
        </Button>

        <div className="bg-white rounded-xl shadow-md p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{campaign.nombre}</h1>
              <p className="text-gray-500 mt-1">ID: {campaign.id}</p>
            </div>
            <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full font-medium">
              {campaign.estado}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center text-gray-500 mb-2">
                <Users className="h-4 w-4 mr-2" />
                Destinatarios
              </div>
              <p className="text-2xl font-bold">{campaign.destinatarios}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center text-gray-500 mb-2">
                <Send className="h-4 w-4 mr-2" />
                Enviados
              </div>
              <p className="text-2xl font-bold">{campaign.enviados}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center text-gray-500 mb-2">
                <CheckCircle className="h-4 w-4 mr-2" />
                Entregados
              </div>
              <p className="text-2xl font-bold text-green-600">{campaign.entregados}</p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Información de Configuración</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Fecha Programada</p>
                <p className="font-medium">{campaign.fechaProgramada}</p>
              </div>
              <div>
                <p className="text-gray-500">Fecha de Creación</p>
                <p className="font-medium">{campaign.fechaCreacion}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CampaignDetailsPage;