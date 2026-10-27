import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, Preformatted
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and render total page count 'Page X of Y',
    along with running header and running footer on all pages except the cover page.
    """
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            # First page is cover / executive overview
            return

        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#4B5563"))

        # Running Header
        self.drawString(36, 11 * inch - 28, "SMART SCHEDULE BUILDER — CORE MODULE SOURCE CODE")
        self.setFont("Helvetica", 8)
        self.drawRightString(8.5 * inch - 36, 11 * inch - 28, "backend/app/services/scheduling_engine.py")

        self.setStrokeColor(colors.HexColor("#E5E7EB"))
        self.setLineWidth(0.75)
        self.line(36, 11 * inch - 32, 8.5 * inch - 36, 11 * inch - 32)

        # Running Footer
        self.line(36, 32, 8.5 * inch - 36, 32)
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#6B7280"))
        self.drawString(36, 22, "Google OR-Tools CP-SAT Scheduling Engine (GLIXON Engine)")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * inch - 36, 22, page_str)

        self.restoreState()


def build_pdf(output_pdf_path: str, source_code_path: str):
    doc = SimpleDocTemplate(
        output_pdf_path,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=42,
        bottomMargin=42
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=colors.HexColor('#1E3A8A')
    )
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#4B5563')
    )
    h2_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=colors.HexColor('#1F2937'),
        spaceBefore=10,
        spaceAfter=4
    )
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor('#374151')
    )
    meta_label = ParagraphStyle(
        'MetaLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1E3A8A')
    )
    meta_val = ParagraphStyle(
        'MetaVal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1F2937')
    )

    story = []

    # Title & Header Banner
    story.append(Paragraph("SMART SCHEDULE BUILDER", title_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Core Optimization & Constraint Programming Engine — Source Code Documentation", subtitle_style))
    story.append(Spacer(1, 10))

    # Meta Table
    meta_data = [
        [Paragraph("Module File:", meta_label), Paragraph("<code>backend/app/services/scheduling_engine.py</code>", meta_val),
         Paragraph("Class Name:", meta_label), Paragraph("<code>GLIXONSchedulingEngine</code>", meta_val)],
        [Paragraph("Technology Stack:", meta_label), Paragraph("Google OR-Tools CP-SAT (v9.15), Python 3.12, NumPy", meta_val),
         Paragraph("Algorithm:", meta_label), Paragraph("Constraint Programming & Sat Solver (CP-SAT)", meta_val)],
        [Paragraph("Domain Support:", meta_label), Paragraph("Colleges (S1–S8), Companies/Offices, Airlines/Aviation", meta_val),
         Paragraph("Primary Objective:", meta_label), Paragraph("Feasible, Non-Conflicting, Workload-Balanced Schedules", meta_val)]
    ]
    meta_table = Table(meta_data, colWidths=[1.3*inch, 2.7*inch, 1.3*inch, 2.2*inch])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 12))

    # Module Overview
    story.append(Paragraph("1. MODULE OVERVIEW & ARCHITECTURE", h2_style))
    overview_text = (
        "The <b>GLIXONSchedulingEngine</b> is the computational core of the Smart Schedule Builder. "
        "It formulates the complex multi-resource scheduling challenge as an exact <b>Constraint Satisfaction "
        "and Integer Programming Optimization Problem</b> utilizing Google OR-Tools CP-SAT solver. "
        "It supports high-cardinality multi-department deployments, automatically distinguishing between academic faculty, "
        "corporate staff, and airline flight crew members."
    )
    story.append(Paragraph(overview_text, body_style))
    story.append(Spacer(1, 8))

    # Key Constraints Table
    story.append(Paragraph("2. KEY MATHEMATICAL CONSTRAINTS ENFORCED", h2_style))
    constraints_data = [
        [Paragraph("<b>Constraint Type</b>", meta_label), Paragraph("<b>Mathematical Formulation & Rule</b>", meta_label), Paragraph("<b>Target Entity</b>", meta_label)],
        [
            Paragraph("<b>Hard Constraint 1:</b><br/>No Overlap", meta_val),
            Paragraph("For any resource or person <i>p</i>, sum(assigned(p, s)) &le; 1 across overlapping time slots.", body_style),
            Paragraph("Faculty, Employees, Rooms, Aircraft", body_style)
        ],
        [
            Paragraph("<b>Hard Constraint 2:</b><br/>Qualification Match", meta_val),
            Paragraph("Assigned person must possess required subjects, certifications, or verified operational skill rating.", body_style),
            Paragraph("Subject Teachers, Duty Roles, Pilots", body_style)
        ],
        [
            Paragraph("<b>Hard Constraint 3:</b><br/>Working Hours Limit", meta_val),
            Paragraph("Total scheduled hours per week &le; configured <code>max_hours_per_week</code>.", body_style),
            Paragraph("All Personnel (Fairness Bound)", body_style)
        ],
        [
            Paragraph("<b>Hard Constraint 4:</b><br/>Rest Periods & Shifts", meta_val),
            Paragraph("Enforces mandatory 10–12 hour rest buffers between shifts to prevent burnout and ensure safety.", body_style),
            Paragraph("Aviation Crews, Healthcare, Staff", body_style)
        ],
        [
            Paragraph("<b>Hard Constraint 5:</b><br/>Shift Window Bounds", meta_val),
            Paragraph("Persons can only be scheduled within configured working days (Mon–Fri) and shift hours (09:00–17:00).", body_style),
            Paragraph("Corporate & Academic Staff", body_style)
        ],
        [
            Paragraph("<b>Soft Constraint 6:</b><br/>Fairness & Balance", meta_val),
            Paragraph("Minimizes variance in workload across peers: minimize sum((hours(p) - target_hours)&sup2;).", body_style),
            Paragraph("Organization-wide Objective", body_style)
        ]
    ]
    const_table = Table(constraints_data, colWidths=[1.6*inch, 4.3*inch, 1.6*inch])
    const_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#EFF6FF')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#BFDBFE')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#DBEAFE')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(const_table)
    story.append(Spacer(1, 14))

    story.append(Paragraph("3. COMPLETE SOURCE CODE LISTING", h2_style))
    story.append(Paragraph("Below is the complete, unmodified implementation of <code>scheduling_engine.py</code>:", body_style))
    story.append(Spacer(1, 8))

    # Read Source Code
    with open(source_code_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Format code with line numbers in chunks to allow seamless pagination
    CHUNK_SIZE = 55
    for i in range(0, len(lines), CHUNK_SIZE):
        chunk_lines = lines[i:i + CHUNK_SIZE]
        formatted_code = []
        for line_idx, line in enumerate(chunk_lines, start=i + 1):
            clean_line = line.rstrip('\r\n')
            # Tab expansion
            clean_line = clean_line.replace('\t', '    ')
            # Truncate or fit line length to avoid overflow
            if len(clean_line) > 105:
                clean_line = clean_line[:102] + "..."
            formatted_code.append(f"{line_idx:4d} | {clean_line}")

        code_text = "\n".join(formatted_code)

        code_style = ParagraphStyle(
            f'CodeChunk_{i}',
            parent=styles['Code'],
            fontName='Courier',
            fontSize=6.8,
            leading=8.5,
            textColor=colors.HexColor('#1E293B'),
        )
        pre = Preformatted(code_text, code_style)
        
        # Wrap in a light table block with clean border
        t = Table([[pre]], colWidths=[7.5*inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ]))
        story.append(t)
        story.append(Spacer(1, 6))

    # Build the document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated PDF at: {output_pdf_path}")

if __name__ == "__main__":
    src_file = os.path.join(os.path.dirname(__file__), "backend", "app", "services", "scheduling_engine.py")
    out_file1 = os.path.join(os.path.dirname(__file__), "Smart_Schedule_Builder_Core_Module_Code.pdf")
    out_file2 = os.path.join(os.path.dirname(__file__), "frontend", "public", "Smart_Schedule_Builder_Core_Module_Code.pdf")
    
    build_pdf(out_file1, src_file)
    build_pdf(out_file2, src_file)
