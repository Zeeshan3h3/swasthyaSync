import datetime
from jinja2 import Template
from jinja2 import Template
from patient_record import RedFlagEntry

_TEMPLATE_STR = """
<!DOCTYPE html>
<html>
<head>
<style>
    body { font-family: sans-serif; margin: 0; padding: 20px; color: #333; }
    {% if priority_flag %}
    .header-banner { background-color: #dc2626; color: white; padding: 15px; font-weight: bold; text-align: center; font-size: 18px; margin-bottom: 20px;}
    {% else %}
    .header-banner { display: none; }
    {% endif %}
    h1 { margin-top: 0; }
    .header-info { margin-bottom: 20px; border-bottom: 2px solid #ccc; padding-bottom: 10px; }
    .header-info p { margin: 4px 0; }
    h2 { font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 25px; }
    .vitals p { margin: 8px 0; font-family: monospace; font-size: 14px; }
    .qa-box { margin-bottom: 10px; }
    .qa-box strong { display: block; }
    .documents { background: #f8fafc; padding: 15px; border-radius: 5px; margin-top: 15px; }
    .abnormal { color: #dc2626; font-weight: bold; }
    .consultation-box { border: 2px solid #94a3b8; height: 300px; margin-top: 15px; border-radius: 5px; }
    .footer { font-size: 10px; color: #64748b; margin-top: 30px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
</style>
</head>
<body>
    {% if priority_flag %}
    <div class="header-banner">
        PRIORITY ALERT: {{ priority_reason }}
    </div>
    {% endif %}

    <h1>Pre-Consultation Summary</h1>
    <div class="header-info">
        <p><strong>Name:</strong> {{ name }}</p>
        <p><strong>Age:</strong> {{ age }}</p>
        <p><strong>Sex:</strong> {{ sex }}</p>
        <p><strong>Phone:</strong> {{ phone }}</p>
        <p><strong>Token:</strong> {{ token }}</p>
        <p><strong>Visit Type:</strong> {{ visit_type }}</p>
        <p><strong>Generated:</strong> {{ generated_timestamp }}</p>
    </div>

    <h2>Vitals</h2>
    <div class="vitals">
        <p>BP: ______ &nbsp;&nbsp; HR: ______ bpm &nbsp;&nbsp; Temp: ______ °F &nbsp;&nbsp; SpO2: ______%</p>
        <p>Height: ______ cm &nbsp;&nbsp; Weight: ______ kg &nbsp;&nbsp; BMI: ______</p>
    </div>

    <h2>Interview Summary</h2>
    <p><strong>Chief Complaint:</strong> {{ chief_complaint }}</p>
    {% for field in filled_state %}
    <div class="qa-box">
        <strong>{{ field.question }}</strong>
        <span>{{ field.answer }}</span>
    </div>
    {% endfor %}

    {% if has_documents %}
    <div class="documents">
        <h2>Documents Summary</h2>
        
        {% if medications %}
        <p><strong>Medications:</strong></p>
        <ul>
            {% for m in medications %}<li>{{ m }}</li>{% endfor %}
        </ul>
        {% endif %}

        {% if diagnoses %}
        <p><strong>Diagnoses:</strong></p>
        <ul>
            {% for d in diagnoses %}<li>{{ d }}</li>{% endfor %}
        </ul>
        {% endif %}

        {% if lab_values %}
        <p><strong>Lab Values:</strong></p>
        <ul>
            {% for lab in lab_values %}
            <li>
                {{ lab.test_name }}: 
                <span class="{% if lab.is_abnormal %}abnormal{% endif %}">{{ lab.value }} {{ lab.unit }}</span>
            </li>
            {% endfor %}
        </ul>
        {% endif %}

        {% if contradictions %}
        <p><strong>Contradictions (Unresolved):</strong></p>
        <ul>
            {% for c in contradictions %}
            <li class="abnormal">{{ c.field }}: Conversational value "{{ c.conversation_value }}" vs Document value "{{ c.document_value }}"</li>
            {% endfor %}
        </ul>
        {% endif %}
        {% if unverifiable_values %}
        <p><strong>Unverifiable/Unrecognized Lab Units (Requires Review):</strong></p>
        <ul>
            {% for u in unverifiable_values %}
            <li class="abnormal">{{ u }}</li>
            {% endfor %}
        </ul>
        {% endif %}
    </div>
    {% endif %}

    <h2>Consultation Summary</h2>
    <div class="consultation-box"></div>

    <div class="footer">
        Token: {{ token }} | Generated: {{ generated_timestamp }}
    </div>
</body>
</html>
"""

def generate_summary_pdf(unified_record: dict) -> bytes:
    """
    Render PDF using FPDF primitives.
    """
    # Prepare data
    filled_state_list = []
    for k, v in unified_record.get("filled_state", {}).items():
        if isinstance(v, dict) and v.get("value"):
            filled_state_list.append({
                "question": k.replace("_", " ").title(),
                "answer": v.get("value")
            })
            
    doc_extractions = unified_record.get("document_extractions", [])
    has_documents = len(doc_extractions) > 0
    
    medications = []
    diagnoses = []
    lab_values = []
    
    for ext in doc_extractions:
        for ent in ext.get("entities", []):
            for med in ent.get("medications", []):
                medications.append(med.get("name") or med.get("drug_name") or "Unknown")
            for dx in ent.get("diagnoses", []):
                diagnoses.append(dx.get("name") or dx.get("condition_name") or "Unknown")
            for lab in ent.get("lab_values", []):
                lab_values.append(lab)

    try:
        from fpdf import FPDF
        pdf = FPDF()
        pdf.add_page()
        
        # Helper variables
        priority_flag = unified_record.get("priority_flag", False)
        priority_reason = unified_record.get("priority_reason", "")
        name = unified_record.get("patient_name") or "Unknown"
        age = str(unified_record.get("patient_age") or "Unknown")
        sex = unified_record.get("patient_sex") or "Unknown"
        phone = unified_record.get("phone") or "Unknown"
        token = unified_record.get("token_id") or "Unknown"
        visit_type = unified_record.get("clinic_mode") or "Unknown"
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        chief_complaint = unified_record.get("chief_complaint") or "None"
        
        # Title/Header
        if priority_flag:
            pdf.set_font("Helvetica", "B", 14)
            pdf.set_text_color(220, 38, 38)
            pdf.cell(0, 10, f"PRIORITY ALERT: {priority_reason}", ln=True, align="C")
            pdf.set_text_color(0, 0, 0)
            
        pdf.set_font("Helvetica", "B", 16)
        pdf.cell(0, 10, "Pre-Consultation Summary", ln=True)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(5)
        
        # Demographics
        pdf.set_font("Helvetica", "", 11)
        pdf.cell(0, 6, f"Name: {name}    Age: {age}    Sex: {sex}", ln=True)
        pdf.cell(0, 6, f"Phone: {phone}    Token: {token}    Visit Type: {visit_type}", ln=True)
        pdf.cell(0, 6, f"Generated: {timestamp}", ln=True)
        pdf.line(10, pdf.get_y()+2, 200, pdf.get_y()+2)
        pdf.ln(8)
        
        # Vitals
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, "Vitals", ln=True)
        pdf.set_font("Courier", "", 10)
        pdf.cell(0, 6, "BP: ______   HR: ______ bpm   Temp: ______ F   SpO2: ______%", ln=True)
        pdf.cell(0, 6, "Height: ______ cm   Weight: ______ kg   BMI: ______", ln=True)
        pdf.ln(5)
        
        # Interview Summary
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, "Interview Summary", ln=True)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(35, 6, "Chief Complaint:")
        pdf.set_font("Helvetica", "", 10)
        
        # safely extract chief complaint which might be a dict
        cc_val = "None"
        if isinstance(chief_complaint, dict):
            cc_val = str(chief_complaint.get("value", ""))
        elif chief_complaint:
            cc_val = str(chief_complaint)
            
        pdf.multi_cell(190, 6, cc_val)
        
        for field in filled_state_list:
            pdf.set_font("Helvetica", "B", 10)
            pdf.multi_cell(190, 6, str(field["question"]))
            pdf.set_font("Helvetica", "", 10)
            pdf.multi_cell(190, 6, str(field["answer"]))
            pdf.ln(2)
            
        # Documents
        if has_documents:
            pdf.ln(5)
            pdf.set_font("Helvetica", "B", 12)
            pdf.cell(0, 8, "Documents Summary", ln=True)
            
            if medications:
                pdf.set_font("Helvetica", "B", 10)
                pdf.cell(0, 6, "Medications:", ln=True)
                pdf.set_font("Helvetica", "", 10)
                for m in medications:
                    pdf.cell(0, 6, f"- {m}", ln=True)
                    
            if diagnoses:
                pdf.set_font("Helvetica", "B", 10)
                pdf.cell(0, 6, "Diagnoses:", ln=True)
                pdf.set_font("Helvetica", "", 10)
                for d in diagnoses:
                    pdf.cell(0, 6, f"- {d}", ln=True)
                    
            if lab_values:
                pdf.set_font("Helvetica", "B", 10)
                pdf.cell(0, 6, "Lab Values:", ln=True)
                for lab in lab_values:
                    is_abnormal = lab.get("is_abnormal")
                    if is_abnormal:
                        pdf.set_text_color(220, 38, 38)
                        pdf.set_font("Helvetica", "B", 10)
                    else:
                        pdf.set_text_color(0, 0, 0)
                        pdf.set_font("Helvetica", "", 10)
                    test_name = lab.get("test_name", "")
                    val = lab.get("value", "")
                    unit = lab.get("unit", "")
                    pdf.cell(0, 6, f"- {test_name}: {val} {unit}", ln=True)
                pdf.set_text_color(0, 0, 0)
                
            contradictions = unified_record.get("contradictions", [])
            if contradictions:
                pdf.set_font("Helvetica", "B", 10)
                pdf.cell(0, 6, "Contradictions (Unresolved):", ln=True)
                pdf.set_text_color(220, 38, 38)
                for c in contradictions:
                    pdf.multi_cell(190, 6, f"- {c.get('field')}: Conversational value '{c.get('conversation_value')}' vs Document value '{c.get('document_value')}'")
                pdf.set_text_color(0, 0, 0)
                
            unverifiable = unified_record.get("unverifiable_values", [])
            if unverifiable:
                pdf.set_font("Helvetica", "B", 10)
                pdf.cell(0, 6, "Unverifiable/Unrecognized Lab Units:", ln=True)
                pdf.set_text_color(220, 38, 38)
                for u in unverifiable:
                    pdf.cell(0, 6, f"- {u}", ln=True)
                pdf.set_text_color(0, 0, 0)

        pdf.ln(10)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, "Consultation Summary", ln=True)
        pdf.rect(10, pdf.get_y(), 190, 80)
        
        return bytes(pdf.output())
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to generate PDF: {e}", exc_info=True)
        return b""
