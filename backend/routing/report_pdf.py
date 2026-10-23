"""Server-side PDF generation for SafeHaul RouteIQ Trip Safety Analysis Reports.

Uses ReportLab Platypus to produce executive, multi-page, publication-quality PDF documents
with strict pagination, auditable metrics, hazard tables, and multi-page checkpoint logs.
"""
import io
import re
from datetime import datetime, timezone

from reportlab.graphics.shapes import Circle, Drawing, Path, Rect
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from .risk import LEVELS


def clean_place_name(place):
    """Extract a clean, concise primary place name from a dict, label, or string."""
    if not place:
        return ""
    if isinstance(place, dict):
        raw = place.get("label") or place.get("name") or place.get("city") or ""
    else:
        raw = str(place)
    raw = raw.strip()
    if not raw:
        return ""
    # Split on first comma (e.g. 'Lahore, Punjab, Pakistan' -> 'Lahore')
    return raw.split(",")[0].strip()


def sanitize_filename_token(token):
    """Sanitize a token for cross-platform filesystem filenames."""
    if not token:
        return ""
    # Remove filesystem-illegal characters (\ / : * ? " < > |)
    clean = re.sub(r'[\\/*?:"<>|]', "", token)
    # Convert whitespace and hyphens into underscores
    clean = re.sub(r'[\s\-]+', "_", clean)
    # Collapse multiple underscores and strip boundary characters
    clean = re.sub(r'_+', "_", clean).strip("._")
    return clean


def build_report_filename(origin, destination):
    """
    Generate dynamic PDF filename based on origin and destination.
    e.g. 'Lahore_to_Islamabad_Route_Report.pdf'
    Falls back to 'SafeHaul_Route_Report.pdf' if either endpoint is unavailable.
    """
    o_name = sanitize_filename_token(clean_place_name(origin))
    d_name = sanitize_filename_token(clean_place_name(destination))
    if o_name and d_name:
        return f"{o_name}_to_{d_name}_Route_Report.pdf"
    return "SafeHaul_Route_Report.pdf"


def build_document_title(origin, destination):
    """
    Generate professional PDF document title for metadata and browser tab display.
    e.g. 'Lahore to Islamabad Route Report'
    Falls back to 'SafeHaul Route Report' if endpoints unavailable.
    """
    o_name = clean_place_name(origin)
    d_name = clean_place_name(destination)
    if o_name and d_name:
        return f"{o_name} to {d_name} Route Report"
    return "SafeHaul Route Report"


def create_header_icon():
    """Create a crisp vector transport safety emblem (shield + commercial semi-truck) in ReportLab."""
    d = Drawing(46, 46)
    # Outer rounded tile container
    d.add(Rect(0, 0, 46, 46, rx=10, ry=10, fillColor=colors.HexColor("#1e3a8a"), strokeColor=colors.HexColor("#3b82f6"), strokeWidth=1.5))

    # Shield background silhouette
    shield = Path(fillColor=colors.HexColor("#1e40af"), strokeColor=None)
    shield.moveTo(23, 41)
    shield.lineTo(39, 36)
    shield.lineTo(39, 21)
    shield.curveTo(39, 13, 31, 8, 23, 5)
    shield.curveTo(15, 8, 7, 13, 7, 21)
    shield.lineTo(7, 36)
    shield.closePath()
    d.add(shield)

    # Semi-truck trailer
    d.add(Rect(9, 19, 16, 14, rx=1.5, ry=1.5, fillColor=colors.HexColor("#ffffff"), strokeColor=None))

    # Semi-truck cab
    cab = Path(fillColor=colors.HexColor("#93c5fd"), strokeColor=None)
    cab.moveTo(26, 19)
    cab.lineTo(34, 19)
    cab.lineTo(36.5, 25)
    cab.lineTo(36.5, 33)
    cab.lineTo(26, 33)
    cab.closePath()
    d.add(cab)

    # Cab windshield
    win = Path(fillColor=colors.HexColor("#1e3a8a"), strokeColor=None)
    win.moveTo(27.5, 25)
    win.lineTo(33.5, 25)
    win.lineTo(32.5, 30)
    win.lineTo(27.5, 30)
    win.closePath()
    d.add(win)

    # Heavy-duty wheels with steel rims
    for cx in (14, 21, 32):
        d.add(Circle(cx, 16.5, 3.2, fillColor=colors.HexColor("#0f172a"), strokeColor=colors.HexColor("#ffffff"), strokeWidth=1))
        d.add(Circle(cx, 16.5, 1.2, fillColor=colors.HexColor("#94a3b8"), strokeColor=None))

    # Highway speed line
    d.add(Rect(7, 10.5, 32, 2, rx=1, ry=1, fillColor=colors.HexColor("#38bdf8"), strokeColor=None))
    return d


class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas that computes total page count and draws consistent running headers/footers."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.setViewerPreference("DisplayDocTitle", "true")
        self._saved_page_states = []
        self.report_date = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(colors.HexColor("#475569"))

        # Running Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(45, 755, "SafeHaul RouteIQ  |  Commercial Trip Safety Analysis Report")
            self.setFont("Helvetica", 7.5)
            self.drawRightString(567, 755, f"Generated: {self.report_date}")
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.75)
            self.line(45, 747, 567, 747)

        # Running Footer (all pages)
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.75)
        self.line(45, 42, 567, 42)

        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#64748b"))
        self.drawString(45, 30, "CONFIDENTIAL & SAFETY CRITICAL — SafeHaul RouteIQ Commercial Vehicle Risk Engine")
        self.drawRightString(567, 30, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()


def _fmt_duration(seconds):
    if not seconds:
        return "0 min"
    m = round(seconds / 60)
    h = m // 60
    mins = m % 60
    return f"{h}h {mins:02d}m" if h > 0 else f"{mins}m"


def _fmt_time(iso_str):
    if not iso_str:
        return "—"
    try:
        dt = datetime.fromisoformat(str(iso_str).replace("Z", "+00:00"))
        return dt.strftime("%b %d, %Y %H:%M UTC")
    except Exception:
        return str(iso_str)


def generate_trip_safety_pdf(trip_data, analysis_data):
    """Generate a comprehensive multi-page PDF document for a trip analysis snapshot."""
    origin_raw = trip_data.get("origin") or trip_data.get("origin_label") or ""
    dest_raw = trip_data.get("destination") or trip_data.get("dest") or trip_data.get("dest_label") or ""

    doc_title = build_document_title(origin_raw, dest_raw)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=45,
        rightMargin=45,
        topMargin=54,
        bottomMargin=54,
        title=doc_title,
        author="SafeHaul RouteIQ",
        subject=f"Trip Safety Analysis Report: {doc_title}",
    )

    styles = getSampleStyleSheet()

    # Custom typography tokens
    c_brand = colors.HexColor("#1e3a8a")     # Deep cobalt
    c_accent = colors.HexColor("#2563eb")    # Bright blue
    c_dark = colors.HexColor("#0f172a")      # Slate 900
    c_muted = colors.HexColor("#475569")     # Slate 600
    c_bg_subtle = colors.HexColor("#f8fafc") # Slate 50
    c_border = colors.HexColor("#e2e8f0")    # Slate 200
    c_danger = colors.HexColor("#b91c1c")    # Red 700
    c_success = colors.HexColor("#047857")   # Emerald 700
    c_warning = colors.HexColor("#b45309")   # Amber 700

    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=c_brand,
        spaceAfter=2,
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=c_muted,
        spaceAfter=12,
    )
    h2_style = ParagraphStyle(
        "SectionH2",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=17,
        textColor=c_brand,
        spaceBefore=14,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "BodyText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=c_dark,
    )
    body_bold = ParagraphStyle(
        "BodyBold",
        parent=body_style,
        fontName="Helvetica-Bold",
    )
    small_style = ParagraphStyle(
        "SmallText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=c_muted,
    )
    small_alert = ParagraphStyle(
        "SmallAlert",
        parent=small_style,
        textColor=c_danger,
        fontName="Helvetica-Bold",
    )
    tbl_cell = ParagraphStyle(
        "TableCell",
        parent=body_style,
        fontSize=8,
        leading=10,
    )
    tbl_cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=tbl_cell,
        fontName="Helvetica-Bold",
    )
    tbl_header = ParagraphStyle(
        "TableHeader",
        parent=tbl_cell,
        fontName="Helvetica-Bold",
        textColor=colors.white,
    )

    badge_style = ParagraphStyle(
        "HeaderBadge",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=11,
        alignment=2,
        textColor=c_brand,
    )

    # Extract core analysis values
    routes = analysis_data.get("routes", [])
    rec_id = analysis_data.get("recommended_id")
    recommended_route = next((r for r in routes if r.get("id") == rec_id), routes[0] if routes else None)

    # Support selected route when multiple routes exist and user picked one
    selected_id = (
        analysis_data.get("selected_id")
        or analysis_data.get("selected_route_id")
        or trip_data.get("selected_id")
        or trip_data.get("selected_route_id")
    )
    selected_route = (
        next((r for r in routes if str(r.get("id")) == str(selected_id)), None)
        if selected_id is not None
        else None
    )
    active_route = selected_route or recommended_route

    all_prohibited = analysis_data.get("all_prohibited", False)
    provenance = analysis_data.get("data_provenance", {})

    origin_label = trip_data.get("origin", {}).get("label") if isinstance(trip_data.get("origin"), dict) else (trip_data.get("origin") or trip_data.get("origin_label", "Origin Location"))
    dest_label = trip_data.get("destination", {}).get("label") if isinstance(trip_data.get("destination"), dict) else (trip_data.get("destination") or trip_data.get("dest_label", "Destination Location"))
    departure_str = _fmt_time(trip_data.get("departure"))
    weight_lb = float(trip_data.get("weight_lb", 42000))
    gen_time_str = datetime.now(timezone.utc).strftime("%b %d, %Y %H:%M UTC")

    story = []

    # 1. Authentic Header Banner with Icon & Corridor Title
    corridor_subtitle = f"{origin_label} → {dest_label}" if origin_label and dest_label else "Commercial Freight Safety & Risk Assessment"
    hdr_table = Table(
        [
            [
                create_header_icon(),
                [
                    Paragraph("SafeHaul RouteIQ™", title_style),
                    Paragraph(
                        f"Commercial Vehicle Trip Safety Analysis &bull; <font color='#2563eb'><b>{corridor_subtitle}</b></font>",
                        subtitle_style,
                    ),
                ],
                Paragraph(
                    "<font color='#1e3a8a'><b>OFFICIAL DISPATCH REPORT</b></font><br/>"
                    "<font color='#64748b' size='6.5'>AUDITED SAFETY EVALUATION</font>",
                    badge_style,
                ),
            ]
        ],
        colWidths=[54, 334, 134],
    )
    hdr_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ])
    )
    story.append(hdr_table)
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_accent, spaceBefore=4, spaceAfter=12))

    # 2. Executive Summary Box
    status_label = "PROHIBITED (NO TRAVEL CONDITIONS)" if all_prohibited else "FEASIBLE DISPATCH RECOMMENDED"
    status_color = c_danger if all_prohibited else c_success

    active_name = active_route.get("name", "N/A") if active_route else "None Available"
    active_dist = f"{active_route.get('distance_mi', 0):.1f} mi" if active_route else "—"
    active_dur = _fmt_duration(active_route.get("duration_s", 0)) if active_route else "—"
    s_active = active_route.get("stats", {}) if active_route else {}
    active_elevated_mi = round(s_active.get("severe_miles", 0) + s_active.get("high_miles", 0) + s_active.get("no_travel_miles", 0), 1)
    active_risk_mi = f"{active_elevated_mi:.1f} mi" if active_route else "—"
    max_lvl = s_active.get("max_level", 0)
    active_class = LEVELS[max_lvl] if max_lvl < len(LEVELS) else "Normal"

    if selected_route and recommended_route and selected_route.get("id") != recommended_route.get("id"):
        rec_disp_title = "Selected Route:"
        rec_disp_val = f"<font color='{c_accent.hexval()}'><b>{active_name}</b></font> (Rec: {recommended_route.get('name', 'N/A')})"
    else:
        rec_disp_title = "Dispatch Recommendation:"
        rec_disp_val = f"<font color='{status_color.hexval()}'><b>{active_name}</b></font>"

    exec_summary_data = [
        [
            Paragraph("<b>Origin:</b>", tbl_cell_bold),
            Paragraph(origin_label, tbl_cell),
            Paragraph(f"<b>{rec_disp_title}</b>", tbl_cell_bold),
            Paragraph(rec_disp_val, tbl_cell),
        ],
        [
            Paragraph("<b>Destination:</b>", tbl_cell_bold),
            Paragraph(dest_label, tbl_cell),
            Paragraph("<b>Overall Dispatch Status:</b>", tbl_cell_bold),
            Paragraph(f"<font color='{status_color.hexval()}'><b>{status_label}</b></font>", tbl_cell),
        ],
        [
            Paragraph("<b>Departure Time:</b>", tbl_cell_bold),
            Paragraph(departure_str, tbl_cell),
            Paragraph("<b>Route Driving Distance:</b>", tbl_cell_bold),
            Paragraph(active_dist, tbl_cell),
        ],
        [
            Paragraph("<b>Gross Load Weight:</b>", tbl_cell_bold),
            Paragraph(f"{weight_lb:,.0f} lb", tbl_cell),
            Paragraph("<b>Estimated Driving Time:</b>", tbl_cell_bold),
            Paragraph(active_dur, tbl_cell),
        ],
        [
            Paragraph("<b>Report Generated:</b>", tbl_cell_bold),
            Paragraph(gen_time_str, tbl_cell),
            Paragraph("<b>Elevated Weather Risk Miles:</b>", tbl_cell_bold),
            Paragraph(f"<b>{active_risk_mi}</b> ({active_class})", tbl_cell),
        ],
    ]

    exec_tbl = Table(exec_summary_data, colWidths=[110, 155, 120, 137])
    exec_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), c_bg_subtle),
        ("BOX", (0, 0), (-1, -1), 1, c_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, c_border),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(exec_tbl)
    story.append(Spacer(1, 10))

    # 3. Route Recommendation & Decision Rationale Section
    story.append(Paragraph("1. Route Recommendation & Decision Rationale", h2_style))
    why_rec = analysis_data.get("rationale") or "Optimal corridor balance."
    story.append(Paragraph(f"<b>Decision Rationale:</b> {why_rec}", body_style))
    story.append(Spacer(1, 10))

    # 4. Evaluated Route Alternatives Table
    story.append(Paragraph("2. Evaluated Route Alternatives Comparison", h2_style))

    alt_headers = [
        Paragraph("<b>Corridor</b>", tbl_header),
        Paragraph("<b>Distance</b>", tbl_header),
        Paragraph("<b>Duration</b>", tbl_header),
        Paragraph("<b>ETA (UTC)</b>", tbl_header),
        Paragraph("<b>Risk Miles</b>", tbl_header),
        Paragraph("<b>Avg Risk</b>", tbl_header),
        Paragraph("<b>Status / Verdict</b>", tbl_header),
    ]

    alt_rows = [alt_headers]
    for r in routes:
        s = r.get("stats", {})
        ev = r.get("evaluation", {})
        elevated_mi = round(s.get("severe_miles", 0) + s.get("high_miles", 0) + s.get("no_travel_miles", 0), 1)
        is_rec = r.get("id") == rec_id
        is_selected = active_route and r.get("id") == active_route.get("id")

        badge_str = f"<b>{r.get('name')}</b>"
        if is_rec and is_selected:
            badge_str += " <font color='#059669'>[RECOMMENDED &bull; SELECTED]</font>"
        elif is_rec:
            badge_str += " <font color='#059669'>[RECOMMENDED]</font>"
        elif is_selected:
            badge_str += " <font color='#2563eb'>[SELECTED]</font>"
        elif s.get("no_travel_miles", 0) > 0:
            badge_str += " <font color='#dc2626'>[PROHIBITED]</font>"

        eta_str = _fmt_time(r.get("checkpoints", [{}])[-1].get("eta")) if r.get("checkpoints") else "—"
        verdict = ev.get("verdict") or (LEVELS[s.get("max_level", 0)] if s else "Evaluated")

        alt_rows.append([
            Paragraph(badge_str, tbl_cell),
            Paragraph(f"{r.get('distance_mi', 0):.1f} mi", tbl_cell),
            Paragraph(_fmt_duration(r.get("duration_s", 0)), tbl_cell),
            Paragraph(eta_str, tbl_cell),
            Paragraph(f"<b>{elevated_mi:.1f} mi</b>", tbl_cell),
            Paragraph(f"{s.get('avg_risk', 0):.2f} / 4.0", tbl_cell),
            Paragraph(verdict, tbl_cell),
        ])

    alt_tbl = Table(alt_rows, colWidths=[105, 50, 55, 95, 60, 52, 105])
    alt_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), c_brand),
        ("BOX", (0, 0), (-1, -1), 0.75, c_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, c_border),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, c_bg_subtle]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(alt_tbl)
    story.append(Spacer(1, 14))

    # 5. Checkpoint Weather & Arrival Log Table (for active route)
    story.append(PageBreak())  # Clean break to ensure checkpoint log starts on Page 2
    story.append(Paragraph(f"3. Waypoint & Weather Log: {active_name}", h2_style))
    story.append(Paragraph(
        f"Highway checkpoints sampled at regular intervals along {active_name}. "
        "Weather values reflect Open-Meteo hourly numerical weather predictions matched to the truck's projected waypoint ETA.",
        small_style
    ))
    story.append(Spacer(1, 6))

    cp_headers = [
        Paragraph("<b>Mile</b>", tbl_header),
        Paragraph("<b>Projected ETA</b>", tbl_header),
        Paragraph("<b>Wind</b>", tbl_header),
        Paragraph("<b>Precipitation</b>", tbl_header),
        Paragraph("<b>Temp</b>", tbl_header),
        Paragraph("<b>Risk Category</b>", tbl_header),
        Paragraph("<b>Hazard & Rule Notes</b>", tbl_header),
    ]

    cp_rows = [cp_headers]
    checkpoints = active_route.get("checkpoints", []) if active_route else []

    for idx, cp in enumerate(checkpoints):
        mile_val = cp.get("mile", cp.get("distance_from_origin_mi", idx * 25))
        eta_val = _fmt_time(cp.get("eta"))
        wind_val = f"{cp.get('wind_mph', cp.get('wind', 0)):.0f} mph" if cp.get("wind_mph") is not None or cp.get("wind") is not None else "Unavailable"
        
        snow_val = cp.get("snow_in_hr", cp.get("snow", 0)) or 0
        rain_val = cp.get("rain_in_hr", cp.get("rain", 0)) or 0
        if snow_val > 0:
            precip_val = f"{snow_val:.2f} in/hr snow"
        elif rain_val > 0:
            precip_val = f"{rain_val:.2f} in/hr rain"
        else:
            precip_val = "0.00 in/hr"

        temp_raw = cp.get("temp_f", cp.get("temp"))
        temp_val = f"{temp_raw:.0f}°F" if temp_raw is not None else "Unavailable"

        lvl_name = cp.get("level_name") or LEVELS[cp.get("level", 0)] if isinstance(cp.get("level"), int) and 0 <= cp.get("level", 0) < len(LEVELS) else str(cp.get("level", "Low"))
        reasons_list = cp.get("reasons") or ([cp.get("risk_reason")] if cp.get("risk_reason") else [])
        reasons_str = "; ".join(reasons_list) if reasons_list else "Favorable road conditions"

        # Highlight severe or no travel rows
        is_critical = "Severe" in lvl_name or "No Travel" in lvl_name
        row_style = tbl_cell_bold if is_critical else tbl_cell

        cp_rows.append([
            Paragraph(f"{mile_val:.0f} mi", row_style),
            Paragraph(eta_val, tbl_cell),
            Paragraph(wind_val, tbl_cell),
            Paragraph(precip_val, tbl_cell),
            Paragraph(temp_val, tbl_cell),
            Paragraph(
                f"<font color='{c_danger.hexval()}'><b>{lvl_name}</b></font>" if is_critical
                else f"<b>{lvl_name}</b>",
                tbl_cell
            ),
            Paragraph(reasons_str, tbl_cell),
        ])

    cp_tbl = Table(cp_rows, colWidths=[45, 95, 52, 70, 45, 75, 140], repeatRows=1)
    cp_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), c_brand),
        ("BOX", (0, 0), (-1, -1), 0.75, c_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, c_border),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, c_bg_subtle]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(cp_tbl)
    story.append(Spacer(1, 14))

    # 6. Data Limitations & Legal Safety Notice
    story.append(KeepTogether([
        Paragraph("4. Data Limitations & Safety Notice", h2_style),
        Paragraph(
            "<b>Forecast Provenance:</b> Weather data is retrieved via Open-Meteo Global Numerical Weather Prediction (Seamless). "
            f"Model base run: {_fmt_time(provenance.get('model_base_time'))} | Cache status: {provenance.get('cache_status', 'N/A')} | "
            f"Forecast validity window: {_fmt_time(provenance.get('forecast_valid_start'))} to {_fmt_time(provenance.get('forecast_valid_end'))}."
            "<br/><br/>"
            "<b>Operational Limitations:</b> Weather conditions change dynamically; drivers must monitor ongoing NOAA/NWS weather radio broadcasts. "
            "Estimated travel durations account for commercial truck speed limitations (1.15x factor) but do not include dynamic traffic incidents, "
            "mandatory federal Hours-of-Service (HOS) rest breaks, weigh station inspections, or localized construction closures. "
            "This report presents modeled risk assessments rather than a legal guarantee of road safety. The motor carrier and commercial driver "
            "retain ultimate statutory responsibility for safe vehicle operation under 49 CFR § 392.14.",
            small_style
        ),
        Spacer(1, 8),
    ]))

    doc.build(story, canvasmaker=NumberedCanvas)
    buf.seek(0)
    return buf.getvalue()
