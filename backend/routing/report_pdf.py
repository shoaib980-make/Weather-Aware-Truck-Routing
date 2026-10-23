"""Server-side PDF generation for SafeHaul RouteIQ Trip Safety Analysis Reports.

Uses ReportLab Platypus to produce executive, multi-page, publication-quality PDF documents
with strict pagination, auditable metrics, hazard tables, and multi-page checkpoint logs.
"""
import io
from datetime import datetime, timezone

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


class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas that computes total page count and draws consistent running headers/footers."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
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
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=45,
        rightMargin=45,
        topMargin=54,
        bottomMargin=54,
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

    story = []

    # 1. Title & Header Banner
    story.append(Paragraph("SafeHaul RouteIQ", title_style))
    story.append(Paragraph("Trip Safety Analysis & Risk Evaluation Report", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_accent, spaceBefore=0, spaceAfter=12))

    # Extract core analysis values
    routes = analysis_data.get("routes", [])
    rec_id = analysis_data.get("recommended_id")
    recommended_route = next((r for r in routes if r.get("id") == rec_id), routes[0] if routes else None)
    all_prohibited = analysis_data.get("all_prohibited", False)
    trade_off = analysis_data.get("trade_off", {})
    provenance = analysis_data.get("data_provenance", {})

    origin_label = trip_data.get("origin", {}).get("label") or trip_data.get("origin_label", "Origin Location")
    dest_label = trip_data.get("destination", {}).get("label") or trip_data.get("dest_label", "Destination Location")
    departure_str = _fmt_time(trip_data.get("departure"))
    weight_lb = float(trip_data.get("weight_lb", 42000))
    gen_time_str = datetime.now(timezone.utc).strftime("%b %d, %Y %H:%M UTC")

    # 2. Executive Summary Box
    status_label = "PROHIBITED (NO TRAVEL CONDITIONS)" if all_prohibited else "FEASIBLE DISPATCH RECOMMENDED"
    status_color = c_danger if all_prohibited else c_success

    rec_name = recommended_route.get("name", "N/A") if recommended_route else "None Available"
    rec_dist = f"{recommended_route.get('distance_mi', 0):.1f} mi" if recommended_route else "—"
    rec_dur = _fmt_duration(recommended_route.get("duration_s", 0)) if recommended_route else "—"
    rec_risk_mi = f"{recommended_route.get('trade_off_metrics', {}).get('elevated_risk_miles', 0):.1f} mi" if recommended_route else "—"
    rec_class = recommended_route.get("trade_off_metrics", {}).get("risk_classification", "Normal") if recommended_route else "N/A"

    exec_summary_data = [
        [
            Paragraph("<b>Origin:</b>", tbl_cell_bold),
            Paragraph(origin_label, tbl_cell),
            Paragraph("<b>Dispatch Recommendation:</b>", tbl_cell_bold),
            Paragraph(f"<font color='{status_color.hexval()}'><b>{rec_name}</b></font>", tbl_cell),
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
            Paragraph(rec_dist, tbl_cell),
        ],
        [
            Paragraph("<b>Gross Load Weight:</b>", tbl_cell_bold),
            Paragraph(f"{weight_lb:,.0f} lb", tbl_cell),
            Paragraph("<b>Estimated Driving Time:</b>", tbl_cell_bold),
            Paragraph(rec_dur, tbl_cell),
        ],
        [
            Paragraph("<b>Report Generated:</b>", tbl_cell_bold),
            Paragraph(gen_time_str, tbl_cell),
            Paragraph("<b>Elevated Weather Risk Miles:</b>", tbl_cell_bold),
            Paragraph(f"<b>{rec_risk_mi}</b> ({rec_class})", tbl_cell),
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

    # 3. Route Recommendation & Trade-Off Analysis Section
    story.append(Paragraph("1. Route Recommendation & Trade-Off Analysis", h2_style))

    why_rec = trade_off.get("why_recommended") or analysis_data.get("rationale") or "Optimal corridor balance."
    why_not_fastest = trade_off.get("why_shortest_not_recommended") or ""

    narrative = f"<b>Decision Rationale:</b> {why_rec}"
    if why_not_fastest and not trade_off.get("is_same_route", False):
        narrative += f"<br/><br/><b>Trade-Off vs. Fastest Alternative:</b> {why_not_fastest}"

    story.append(Paragraph(narrative, body_style))
    story.append(Spacer(1, 8))

    # Trade-off metrics mini-table
    if trade_off and not trade_off.get("is_same_route", False):
        to_data = [
            [
                Paragraph("<b>Trade-Off Metric</b>", tbl_header),
                Paragraph("<b>Fastest Feasible Route</b>", tbl_header),
                Paragraph("<b>Recommended Safer Route</b>", tbl_header),
                Paragraph("<b>Net Dispatch Trade-Off</b>", tbl_header),
            ],
            [
                Paragraph("Corridor Identifier", tbl_cell),
                Paragraph(str(trade_off.get("fastest_route_name", "Fastest")), tbl_cell_bold),
                Paragraph(str(trade_off.get("recommended_route_name", "Recommended")), tbl_cell_bold),
                Paragraph("Safer Alternative Selected", tbl_cell),
            ],
            [
                Paragraph("Elevated Risk Miles", tbl_cell),
                Paragraph(f"{trade_off.get('fastest_elevated_risk_miles', 0):.1f} mi", tbl_cell),
                Paragraph(f"{trade_off.get('recommended_elevated_risk_miles', 0):.1f} mi", tbl_cell),
                Paragraph(f"<font color='{c_success.hexval()}'><b>-{trade_off.get('risk_reduction_mi', 0):.1f} mi ({trade_off.get('risk_reduction_pct', 0):.1f}% reduction)</b></font>", tbl_cell),
            ],
            [
                Paragraph("Travel Duration", tbl_cell),
                Paragraph("Baseline Fastest", tbl_cell),
                Paragraph(f"+{trade_off.get('additional_travel_time_min', 0)} min", tbl_cell),
                Paragraph(f"+{trade_off.get('additional_travel_time_min', 0)} min driving time penalty", tbl_cell),
            ],
            [
                Paragraph("Highway Distance", tbl_cell),
                Paragraph("Baseline Distance", tbl_cell),
                Paragraph(f"+{trade_off.get('additional_distance_mi', 0):.1f} mi", tbl_cell),
                Paragraph(f"+{trade_off.get('additional_distance_mi', 0):.1f} mi extra mileage", tbl_cell),
            ],
        ]
        to_tbl = Table(to_data, colWidths=[120, 125, 125, 152])
        to_tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), c_brand),
            ("BOX", (0, 0), (-1, -1), 0.75, c_border),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, c_border),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, c_bg_subtle]),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(to_tbl)
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
        m = r.get("trade_off_metrics", {})
        is_rec = r.get("id") == rec_id

        badge_str = f"<b>{r.get('name')}</b>"
        if is_rec:
            badge_str += " <font color='#059669'>[RECOMMENDED]</font>"
        elif s.get("no_travel_miles", 0) > 0:
            badge_str += " <font color='#dc2626'>[PROHIBITED]</font>"

        eta_str = _fmt_time(r.get("checkpoints", [{}])[-1].get("eta")) if r.get("checkpoints") else "—"
        verdict = ev.get("verdict") or m.get("risk_classification") or "Evaluated"

        alt_rows.append([
            Paragraph(badge_str, tbl_cell),
            Paragraph(f"{r.get('distance_mi', 0):.1f} mi", tbl_cell),
            Paragraph(_fmt_duration(r.get("duration_s", 0)), tbl_cell),
            Paragraph(eta_str, tbl_cell),
            Paragraph(f"<b>{m.get('elevated_risk_miles', 0):.1f} mi</b>", tbl_cell),
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
    story.append(Spacer(1, 10))

    # 5. Non-Overlapping Hazard Exposure Breakdown
    story.append(Paragraph("3. Physical Hazard Exposure Breakdown", h2_style))
    story.append(Paragraph(
        "<i>Methodology: Risk miles represent road segments subject to elevated weather hazards. "
        "Hazard segments are measured along highway centerline checkpoints to eliminate double-counting.</i>",
        small_style
    ))
    story.append(Spacer(1, 4))

    haz_headers = [
        Paragraph("<b>Corridor</b>", tbl_header),
        Paragraph("<b>High Wind (&ge;35 mph)</b>", tbl_header),
        Paragraph("<b>Heavy Rain (&gt;0.25\")</b>", tbl_header),
        Paragraph("<b>Snow / Ice (&gt;0.5\")</b>", tbl_header),
        Paragraph("<b>Severe Storms</b>", tbl_header),
        Paragraph("<b>No Travel (Restricted)</b>", tbl_header),
        Paragraph("<b>Total Audited mi</b>", tbl_header),
    ]
    haz_rows = [haz_headers]

    for r in routes:
        m = r.get("trade_off_metrics", {})
        hb = m.get("hazard_breakdown", {})
        s = r.get("stats", {})

        haz_rows.append([
            Paragraph(f"<b>{r.get('name')}</b>", tbl_cell),
            Paragraph(f"{hb.get('high_wind_miles', 0):.1f} mi", tbl_cell),
            Paragraph(f"{hb.get('heavy_rain_miles', 0):.1f} mi", tbl_cell),
            Paragraph(f"{hb.get('snow_ice_miles', 0):.1f} mi", tbl_cell),
            Paragraph(f"{hb.get('severe_conditions_miles', 0):.1f} mi", tbl_cell),
            Paragraph(
                f"<font color='{c_danger.hexval()}'><b>{s.get('no_travel_miles', 0):.1f} mi</b></font>"
                if s.get("no_travel_miles", 0) > 0 else "0.0 mi",
                tbl_cell
            ),
            Paragraph(f"<b>{s.get('audited_miles_sum', r.get('distance_mi', 0)):.1f} mi</b>", tbl_cell_bold),
        ])

    haz_tbl = Table(haz_rows, colWidths=[92, 75, 75, 70, 70, 75, 65])
    haz_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), c_brand),
        ("BOX", (0, 0), (-1, -1), 0.75, c_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, c_border),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, c_bg_subtle]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(haz_tbl)
    story.append(Spacer(1, 14))

    # 6. Checkpoint Weather & Arrival Log Table (for recommended route)
    story.append(PageBreak())  # Clean break to ensure checkpoint log starts on Page 2
    story.append(Paragraph(f"4. Waypoint & Weather Log: {rec_name}", h2_style))
    story.append(Paragraph(
        f"Highway checkpoints sampled at regular intervals along {rec_name}. "
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
    checkpoints = recommended_route.get("checkpoints", []) if recommended_route else []

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

    # 7. Data Limitations & Legal Safety Notice
    story.append(KeepTogether([
        Paragraph("5. Data Limitations & Safety Notice", h2_style),
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
