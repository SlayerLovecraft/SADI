import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import PatientLayout from '@/layouts/PatientLayout';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Heart } from 'lucide-react';

const PatientHealthPage = () => {
  const [form, setForm] = useState({
    glucometry: '',
    bloodPressure: '',
    heartRate: '',
    temperature: '',
    weight: ''
  });
  const { toast } = useToast();

  const handleSubmit = (e) => {
    e.preventDefault();
    // In a real app, this would save to DB
    // Here we just simulate
    const newEntry = {
      patientId: 'p1',
      date: new Date().toISOString().split('T')[0],
      ...form
    };
    
    const existing = JSON.parse(localStorage.getItem('sadi_vital_signs') || '[]');
    localStorage.setItem('sadi_vital_signs', JSON.stringify([...existing, newEntry]));
    
    toast({
      title: "Registros guardados",
      description: "Tus signos vitales han sido actualizados exitosamente."
    });
    
    setForm({ glucometry: '', bloodPressure: '', heartRate: '', temperature: '', weight: '' });
  };

  return (
    <PatientLayout>
      <Helmet>
        <title>Mi Salud - Registro Diario</title>
      </Helmet>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-red-100 rounded-full mb-4">
            <Heart className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Registro Diario de Salud</h1>
          <p className="text-gray-500">Ayúdanos a monitorear tu salud registrando tus signos vitales hoy.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="glucometry">Glucometría (mg/dL)</Label>
              <input
                id="glucometry"
                type="number"
                value={form.glucometry}
                onChange={e => setForm({...form, glucometry: e.target.value})}
                className="w-full mt-2 p-3 border border-gray-300 rounded-lg"
                placeholder="Ej: 90"
                required
              />
            </div>
            <div>
              <Label htmlFor="bp">Presión Arterial</Label>
              <input
                id="bp"
                type="text"
                value={form.bloodPressure}
                onChange={e => setForm({...form, bloodPressure: e.target.value})}
                className="w-full mt-2 p-3 border border-gray-300 rounded-lg"
                placeholder="Ej: 120/80"
                required
              />
            </div>
            <div>
              <Label htmlFor="hr">Ritmo Cardíaco (bpm)</Label>
              <input
                id="hr"
                type="number"
                value={form.heartRate}
                onChange={e => setForm({...form, heartRate: e.target.value})}
                className="w-full mt-2 p-3 border border-gray-300 rounded-lg"
                placeholder="Ej: 72"
                required
              />
            </div>
            <div>
              <Label htmlFor="temp">Temperatura (°C)</Label>
              <input
                id="temp"
                type="number"
                step="0.1"
                value={form.temperature}
                onChange={e => setForm({...form, temperature: e.target.value})}
                className="w-full mt-2 p-3 border border-gray-300 rounded-lg"
                placeholder="Ej: 36.5"
                required
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="weight">Peso (kg)</Label>
              <input
                id="weight"
                type="number"
                step="0.1"
                value={form.weight}
                onChange={e => setForm({...form, weight: e.target.value})}
                className="w-full mt-2 p-3 border border-gray-300 rounded-lg"
                placeholder="Ej: 70.5"
                required
              />
            </div>
          </div>
          
          <Button type="submit" className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-lg">
            Guardar Registro Diario
          </Button>
        </form>
      </div>
    </PatientLayout>
  );
};

export default PatientHealthPage;