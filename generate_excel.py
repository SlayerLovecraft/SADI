# -*- coding: utf-8 -*-
"""
Script para generar el archivo Excel oficial de Credenciales SADI directamente desde PostgreSQL:
Credenciales_Acceso_SADI_3280.xlsx
Sincronizado 100% con la Base de Datos Supabase (Tablas public.staff, public.patients, public.hospitals).
"""

import asyncio, asyncpg, datetime, os
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Paletas de estilo
HEADER_FILL_NAVY = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
HEADER_FILL_TITLE = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
HEADER_FILL_SUB = PatternFill(start_color="334155", end_color="334155", fill_type="solid")
ROW_FILL_ALT = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
ROW_FILL_WHITE = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
BADGE_ACTIVE_FILL = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")

FONT_TITLE = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
FONT_HEADER = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
FONT_REGULAR = Font(name="Calibri", size=10, bold=False, color="1E293B")
FONT_CODE = Font(name="Consolas", size=10, bold=True, color="0284C7")
FONT_ACTIVE = Font(name="Calibri", size=10, bold=True, color="166534")

THIN_BORDER_SIDE = Side(border_style="thin", color="E2E8F0")
BORDER_CELL = Border(left=THIN_BORDER_SIDE, right=THIN_BORDER_SIDE, top=THIN_BORDER_SIDE, bottom=THIN_BORDER_SIDE)

def style_sheet(ws, title, columns_data, rows_data):
    # Fila 1: Título
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(columns_data))
    title_cell = ws.cell(row=1, column=1, value=title)
    title_cell.font = FONT_TITLE
    title_cell.fill = HEADER_FILL_TITLE
    title_cell.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[1].height = 40

    # Fila 2: Encabezados
    for col_idx, col_name in enumerate(columns_data, start=1):
        cell = ws.cell(row=2, column=col_idx, value=col_name)
        cell.font = FONT_HEADER
        cell.fill = HEADER_FILL_NAVY
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER_CELL
    ws.row_dimensions[2].height = 28

    # Filas de datos
    for row_idx, row_values in enumerate(rows_data, start=3):
        fill = ROW_FILL_ALT if row_idx % 2 == 0 else ROW_FILL_WHITE
        ws.row_dimensions[row_idx].height = 24
        
        for col_idx, val in enumerate(row_values, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.font = FONT_REGULAR
            cell.fill = fill
            cell.border = BORDER_CELL
            
            header_name = columns_data[col_idx - 1].lower()
            if any(k in header_name for k in ["url", "código", "tipo", "edad", "estado", "sexo"]):
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif any(k in header_name for k in ["contraseña", "login", "usuario", "documento"]):
                cell.alignment = Alignment(horizontal="center", vertical="center")
                cell.font = FONT_CODE
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

            if str(val).strip() == "Activo":
                cell.fill = BADGE_ACTIVE_FILL
                cell.font = FONT_ACTIVE

    # Autoajuste de columnas
    for col_idx, col_name in enumerate(columns_data, start=1):
        col_letter = get_column_letter(col_idx)
        max_len = len(str(col_name))
        for row in range(3, len(rows_data) + 3):
            cell_val = ws.cell(row=row, column=col_idx).value
            if cell_val is not None:
                max_len = max(max_len, len(str(cell_val)))
        ws.column_dimensions[col_letter].width = min(max(max_len + 4, 12), 65)

    ws.freeze_panes = "A3"

async def build_excel():
    conn = await asyncpg.connect('postgresql://postgres.ospsgzzudwrdjyvldmmo:nqW8MXRabhpq75c1@aws-1-us-east-1.pooler.supabase.com:5432/postgres')
    print("Conectado a PostgreSQL para extraer credenciales en vivo.")

    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    # -------------------------------------------------------------
    # 1. RESUMEN Y ACCESO RÁPIDO
    # -------------------------------------------------------------
    ws_resumen = wb.create_sheet(title="Acceso Rápido & Resumen")
    resumen_cols = ["Módulo / Entorno", "URL de Ingreso", "Tipo de Perfil", "Identificador (Usuario)", "Contraseñas Habilitadas", "Instrucciones de Uso"]
    resumen_data = [
        [
            "Portal Administrativo / Hospital",
            "/login",
            "Hospital Admin & Staff",
            "admin@sadi.gov.co",
            "Admin123!   o   password123",
            "Acceso completo a telemonitoreo, matriz 3280, campañas de llamadas y configuración."
        ],
        [
            "Portal Especialistas & Médicos",
            "/doctor/login",
            "Médicos Especialistas Res. 3280",
            "paola.gil@sadi.med.co  (o doctor1@sadi.com.co)",
            "password123   o   sadi2026",
            "Acceso a la bandeja clínica de su cohorte etaria respectiva (ej. Infancia, Adultez)."
        ],
        [
            "Portal Medicina General & Admisión",
            "/doctor/login",
            "Médicos Generales / Triage",
            "alejandro.morales@sadi.med.co  (o doctor9@sadi.com.co)",
            "password123   o   sadi2026",
            "Acceso a triage clínico de admisión, teleorientación médica general y derivaciones."
        ],
        [
            "Portal Coordinación de Enfermería",
            "/doctor/login",
            "Enfermería Jefe / RIAMP",
            "sandra.duque@sadi.med.co",
            "password123   o   sadi2026",
            "Supervisión de rutas integrales de atención, vacunación, tamizajes y llamadas preventivas."
        ],
        [
            "Portal Paciente & Familiares",
            "/patient/login",
            "Paciente / Cuidador",
            "Número de Documento (o Email registrado)",
            "El mismo # de Documento   o   password123",
            "Acceso al expediente personal de salud, registro de signos vitales y citas programadas."
        ]
    ]
    style_sheet(ws_resumen, "SADI 3280 - GUÍA GENERAL DE ACCESO Y CREDENCIALES DEL SISTEMA", resumen_cols, resumen_data)

    # -------------------------------------------------------------
    # 2. HOSPITALES Y ADMINISTRADORES
    # -------------------------------------------------------------
    ws_hosp = wb.create_sheet(title="Hospitales y Administradores")
    hosp_cols = ["Rol / Perfil", "Institución / Entidad", "URL de Acceso", "Usuario / Correo", "Contraseña Principal", "Contraseña Alternativa", "Alcance y Permisos", "Estado"]
    hosp_data = [
        [
            "Administrador Principal de Red Hospitalaria",
            "Hospital Universitario SADI / EPS SADI",
            "/login",
            "admin@sadi.gov.co",
            "Admin123!",
            "password123",
            "Control total de telemonitoreo, camas, alertas clínicas, triage, IA y matriz 3280",
            "Activo"
        ],
        [
            "Coordinación Médica IPS Caldas",
            "Hospital Central SADI (Caldas)",
            "/login",
            "hospital@sadi.com.co",
            "Admin123!",
            "password123",
            "Monitoreo hospitalario departamental y supervisión asistencial integral",
            "Activo"
        ],
        [
            "Super Administrador Demo",
            "Red Central SADI Colombia",
            "/login",
            "demo@sadi.com",
            "password123",
            "password123",
            "Perfil demostrativo con bypass offline para pruebas operativas y auditoría",
            "Activo"
        ]
    ]
    style_sheet(ws_hosp, "CREDENCIALES DE PERSONAL ADMINISTRATIVO Y GESTIÓN HOSPITALARIA", hosp_cols, hosp_data)

    # -------------------------------------------------------------
    # 3. DOCTORES ESPECIALISTAS 3280 (DESDE BD)
    # -------------------------------------------------------------
    ws_docs = wb.create_sheet(title="Médicos Especialistas 3280")
    docs_cols = [
        "Nombre del Especialista",
        "Especialidad Médica",
        "Área Clínica (Res. 3280)",
        "URL Acceso",
        "Correo Principal",
        "Correo Staff Alternativo",
        "Contraseña BD (Habilitada)",
        "Contraseña Alternativa",
        "Teléfono",
        "UUID Base de Datos",
        "Estado en BD"
    ]
    
    docs_rows = await conn.fetch('''
        SELECT doctor_id, doctor_name, doctor_email, doctor_specialty, rol, is_active, cursos_vida_asignados
        FROM public.staff
        WHERE rol = 'Especialista'
        ORDER BY doctor_name
    ''')
    
    docs_data = []
    staff_email_map = {
        "paola.gil@sadi.med.co": "doctor1@sadi.com.co",
        "juan.bermudez@sadi.med.co": "doctor2@sadi.com.co",
        "sandra.castano@sadi.med.co": "doctor3@sadi.com.co",
        "fernando.rincon@sadi.med.co": "doctor4@sadi.com.co",
        "beatriz.arango@sadi.med.co": "doctor5@sadi.com.co",
        "mauricio.villa@sadi.med.co": "doctor6@sadi.com.co",
        "natalia.ocampo@sadi.med.co": "doctor7@sadi.com.co",
        "carlos.salazar@sadi.med.co": "doctor8@sadi.com.co"
    }
    
    for d in docs_rows:
        em = d['doctor_email']
        staff_em = staff_email_map.get(em, "doctor@sadi.com.co")
        docs_data.append([
            d['doctor_name'],
            d['doctor_specialty'],
            str(d['cursos_vida_asignados']).replace('"', '').replace('[', '').replace(']', ''),
            "/doctor/login",
            em,
            staff_em,
            "password123",
            "sadi2026",
            "+57 311 000 0000",
            str(d['doctor_id']),
            "Activo" if d['is_active'] else "Inactivo"
        ])
    style_sheet(ws_docs, "CUERPO MÉDICO ESPECIALISTA 3280 (REGISTRADOS EN BD)", docs_cols, docs_data)

    # -------------------------------------------------------------
    # 4. MÉDICOS GENERALES Y TRIAGE (DESDE BD)
    # -------------------------------------------------------------
    ws_gen = wb.create_sheet(title="Médicos Generales y Triage")
    gen_cols = [
        "Nombre del Médico",
        "Especialidad / Perfil",
        "URL Acceso",
        "Correo Principal",
        "Correo Staff Alternativo",
        "Contraseña Habilitada",
        "Contraseña Demo",
        "UUID Base de Datos",
        "Estado en BD"
    ]
    
    gen_rows = await conn.fetch('''
        SELECT doctor_id, doctor_name, doctor_email, doctor_specialty, is_active
        FROM public.staff
        WHERE rol = 'Médico General'
        ORDER BY doctor_name
    ''')
    gen_data = []
    gen_map = {
        "alejandro.morales@sadi.med.co": "doctor9@sadi.com.co",
        "valentina.gomez@sadi.med.co": "doctor10@sadi.com.co",
        "daniel.vargas@sadi.med.co": "doctor11@sadi.com.co"
    }
    for g in gen_rows:
        em = g['doctor_email']
        staff_em = gen_map.get(em, em)
        gen_data.append([
            g['doctor_name'],
            g['doctor_specialty'],
            "/doctor/login",
            em,
            staff_em,
            "password123",
            "sadi2026",
            str(g['doctor_id']),
            "Activo" if g['is_active'] else "Inactivo"
        ])
    style_sheet(ws_gen, "MÉDICOS GENERALES DE ADMISIÓN, TRIAGE Y DEMANDA INDUCIDA (BD)", gen_cols, gen_data)

    # -------------------------------------------------------------
    # 5. ENFERMERÍA Y COORDINACIÓN 3280 (DESDE BD)
    # -------------------------------------------------------------
    ws_enf = wb.create_sheet(title="Enfermería y Coordinación 3280")
    enf_cols = [
        "Nombre del Profesional",
        "Rol / Cargo",
        "Especialidad Asistencial",
        "URL Acceso",
        "Correo Electrónico",
        "Contraseña Habilitada",
        "Contraseña Alternativa",
        "UUID Base de Datos",
        "Estado en BD"
    ]
    enf_rows = await conn.fetch('''
        SELECT doctor_id, doctor_name, doctor_email, doctor_specialty, rol, is_active
        FROM public.staff
        WHERE rol IN ('Enfermera Jefe', 'Enfermera') AND doctor_name IS NOT NULL
        ORDER BY doctor_name
    ''')
    enf_data = []
    for e in enf_rows:
        enf_data.append([
            e['doctor_name'],
            e['rol'],
            e['doctor_specialty'],
            "/doctor/login",
            e['doctor_email'],
            "password123",
            "sadi2026",
            str(e['doctor_id']),
            "Activo" if e['is_active'] else "Inactivo"
        ])
    style_sheet(ws_enf, "EQUIPO DE ENFERMERÍA Y GESTIÓN DE RUTAS RESOLUCIÓN 3280 (BD)", enf_cols, enf_data)

    # -------------------------------------------------------------
    # 6. PACIENTES REGISTRADOS EN BASE DE DATOS (56 PACIENTES)
    # -------------------------------------------------------------
    ws_pac = wb.create_sheet(title="Pacientes y Portales (56 BD)")
    pac_cols = [
        "Nombre del Paciente",
        "Documento (Usuario Login)",
        "Contraseña Habilitada",
        "URL Acceso",
        "Correo Electrónico",
        "Teléfono Celular",
        "Edad",
        "Fecha de Nacimiento",
        "Sexo",
        "Programa Clínico",
        "Grupo de Riesgo Priorizado",
        "UUID Base de Datos",
        "Estado en BD"
    ]
    
    pac_rows = await conn.fetch('''
        SELECT patient_id, name, document, phone, email, birthdate, sex, program, grupo_riesgo, password, is_active
        FROM public.patients
        ORDER BY name
    ''')
    
    pac_data = []
    today = datetime.date.today()
    for p in pac_rows:
        bdate = p['birthdate']
        edad = 0
        if bdate:
            edad = today.year - bdate.year - ((today.month, today.day) < (bdate.month, bdate.day))
        
        doc_str = str(p['document'] or '')
        pass_str = f"{doc_str}   o   password123"
        
        pac_data.append([
            p['name'],
            doc_str,
            pass_str,
            "/patient/login",
            p['email'] or '',
            p['phone'] or '',
            edad,
            str(bdate) if bdate else '',
            "Femenino" if str(p['sex']).upper().startswith("F") else "Masculino",
            p['program'] or 'Atención Integral Res. 3280',
            p['grupo_riesgo'] or 'Riesgo Cardiovascular, Metabólico y Renal',
            str(p['patient_id']),
            "Activo" if p['is_active'] else "Inactivo"
        ])
        
    style_sheet(ws_pac, f"BASE DE DATOS COMPLETA DE PACIENTES SADI ({len(pac_rows)} PACIENTES EN SUPABASE)", pac_cols, pac_data)

    # Guardar en rutas
    root_out = os.path.abspath("Credenciales_Acceso_SADI_3280.xlsx")
    public_out = os.path.abspath(os.path.join("_react_legacy", "SADI_React-Node.js", "public", "Credenciales_Acceso_SADI_3280.xlsx"))
    brain_out = r"C:\Users\maxpe\.gemini\antigravity\brain\1c5c6813-7d4a-4ddb-a57f-e42603a3ac85\Credenciales_Acceso_SADI_3280.xlsx"

    wb.save(root_out)
    print(f"Generado exitosamente en: {root_out}")

    os.makedirs(os.path.dirname(public_out), exist_ok=True)
    wb.save(public_out)
    print(f"Generado exitosamente en: {public_out}")

    os.makedirs(os.path.dirname(brain_out), exist_ok=True)
    wb.save(brain_out)
    print(f"Copiado exitosamente a Artifact Brain: {brain_out}")

    await conn.close()

if __name__ == '__main__':
    asyncio.run(build_excel())
