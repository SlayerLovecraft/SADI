path_login = '_react_legacy/SADI_React-Node.js/src/pages/LoginPage.jsx'
with open(path_login, 'r', encoding='utf-8') as f:
    text = f.read()

target = '<Button type="submit" className="w-full py-3" disabled={isSubmitting}>\n                {isSubmitting ? \'Validando...\' : \'Ingresar al Portal Admin\'}\n              </Button>'
# If newlines differ, let's find by substring
target_sub = '{isSubmitting ? \'Validando...\' : \'Ingresar al Portal Admin\'}'

if target_sub in text:
    idx = text.find(target_sub)
    button_end = text.find('</Button>', idx) + len('</Button>')
    addition = """

              <Button 
                type="button" 
                onClick={async () => {
                  setEmail('admin@sadi.gov.co');
                  setPassword('Admin123!');
                  setIsSubmitting(true);
                  const result = await loginHospital('admin@sadi.gov.co', 'Admin123!');
                  if (result.success) {
                    navigate('/telemonitoring', { replace: true });
                  }
                  setIsSubmitting(false);
                }} 
                variant="outline"
                className="w-full py-3 border-2 border-indigo-400 text-indigo-700 hover:bg-indigo-50 font-bold flex items-center justify-center gap-2 shadow-sm rounded-xl"
              >
                🩺 Acceso Rápido Demo (Telemonitoreo & Res. 3280)
              </Button>"""
    text = text[:button_end] + addition + text[button_end:]
    with open(path_login, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    print("SUCCESS: LoginPage.jsx updated with Quick Demo Access button!")
else:
    print("WARNING: target_sub not found in LoginPage.jsx")
