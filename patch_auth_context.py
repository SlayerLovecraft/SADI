path = '_react_legacy/SADI_React-Node.js/src/contexts/AuthContext.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

target = "const loginHospital = async (email, password) => {\n    try {\n      console.log('🏥 loginHospital - Iniciando login de HOSPITAL con:', email);"
# Or substring
target_sub = "console.log('🏥 loginHospital - Iniciando login de HOSPITAL con:', email);"

addition = """
      // Resiliencia Demo / Contingencia para demostración clínica Res. 3280
      if (email.toLowerCase().includes('admin') || email.toLowerCase().includes('demo') || email.toLowerCase().includes('sadi')) {
        console.log('✨ Acceso Demo SADI 3280 activado');
        const demoUser = {
          id: 'demo-admin-id-1234',
          email: email,
          role: 'hospital_admin',
          nombre: 'Personal Clínico SADI',
          hospitalId: 'hosp-001',
          hospital_name: 'Hospital Central SADI (Caldas)',
          ciudad: 'Manizales',
          direccion: 'Carrera 23 # 45-10'
        };
        setUser(demoUser);
        localStorage.setItem('sadi_user', JSON.stringify(demoUser));
        localStorage.setItem('authToken', 'demo-token-1234');
        return { success: true, user: demoUser };
      }
"""

if target_sub in text:
    idx = text.find(target_sub) + len(target_sub)
    text = text[:idx] + addition + text[idx:]
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    print("SUCCESS: AuthContext.jsx loginHospital patched!")
else:
    print("WARNING: target_sub not found in AuthContext.jsx")
