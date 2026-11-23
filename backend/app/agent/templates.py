"""Deterministic answers from tool results (used when AI is unavailable, and as the facts an AI phrasing is grounded on).

Only numbers present in the tool result are printed (₹ via app.fmt.inr, quantities with their UoM).
"""
from __future__ import annotations

from app.agent.tools import ToolResult
from app.fmt import day, inr


def _q(v, uom=None) -> str:
    return "—" if v is None else f"{int(v):,}{' ' + uom if uom else ''}"


def _pair(r: dict) -> str:
    return f"{r['material']} at {r['plant']}"


def render(tool: str, res: ToolResult, question: str = "") -> str:
    d = res.data
    f = _RENDER.get(tool)
    return f(d, question) if f else str(d)[:800]


def other_line(o: dict | None) -> str:
    """One sentence on the non-default demand source (D33); numbers copied from the tool result."""
    if not o:
        return ""
    if o["source"] == "production_orders":
        n, tot = o["short_pairs"], o["pairs_with_demand"]
        who = f"all {tot}" if n == tot else f"{n} of {tot}"
        need = (f" (open orders need a median {o['requirement_vs_usable_median']}× current usable stock, "
                f"range {o['requirement_vs_usable_min']}–{o['requirement_vs_usable_max']}×)"
                if o.get("requirement_vs_usable_median") is not None else "")
        return (f" On your production orders, {who} material × plant pairs with demand are short{need}; "
                "proposals use the planning scenario (A21).")
    sc = o["status_counts"]
    return f" On the planning scenario: {sc['critical']} critical and {sc['at_risk']} at risk (A15)."


def _brief(d, q):
    if not d.get("brief", True):
        return "No brief yet — upload the dataset first."
    sc = d["status_counts"]
    p = d.get("proposals", {})
    pb, pm = p.get("pending_buyer", {"count": 0, "value_inr": 0}), p.get("pending_manager", {"count": 0, "value_inr": 0})
    tops = "; ".join(f"{c['material_id']} at {c['plant_id']} below safety stock in {c['days_to_shortage']} day(s)"
                     for c in d.get("top_critical", []))
    return (f"Data as of {day(d['as_of'])} ({d['data_age_days']} days old). {sc['critical']} pairs are critical and "
            f"{sc['at_risk']} at risk; most urgent: {tops}. {d['production_orders_at_risk_14d']} planned orders in the next "
            f"14 days start after a stock-out. Excess {inr(d['excess_value_inr'])}; {d['overdue_po_lines']} of "
            f"{d['open_po_lines']} open PO lines are overdue. Approvals: {pb['count']} for the purchasing officer ({inr(pb['value_inr'])}), "
            f"{pm['count']} for the manager ({inr(pm['value_inr'])}). Health {d['inventory_health_pct']}%."
            + other_line(d.get("other_source")))


def _overview(d, q):
    sc = d["status_counts"]
    lines = [
        f"### 📊 Inventory Health Overview Across {', '.join(d['plants'])}",
        f"Overall Inventory Health is **{d['health_pct']}%** with total on-hand value of **{inr(d['on_hand_value_inr'])}**.",
        "",
        "| Status | Pairs Count | Impact Summary |",
        "| :--- | :--- | :--- |",
        f"| 🔴 **Critical** | {sc['critical']} | {d['critical_in_7d']} pairs go below safety stock within 7 days |",
        f"| 🟡 **At Risk** | {sc['at_risk']} | Monitored for potential stockouts |",
        f"| 📦 **Excess** | {sc['excess']} | {inr(d['excess_value_inr'])} tied up above max stock |",
        f"| 🟢 **Healthy** | {sc['healthy']} | Optimal inventory levels |",
        f"| ⚪ **No Demand Basis** | {sc['stale']} | Consumables / unassigned demand |",
        "",
        f"• **Planned Orders at Risk:** {d['orders_at_risk']} planned orders start after a projected stock-out.",
        f"• **Pending Approvals:** {d['pending_approvals']} replenishment proposals worth **{inr(d['pending_value_inr'])}**.",
        f"• **Overdue PO Lines:** {d['overdue_po_lines']} purchase order lines are currently overdue.",
    ]
    other = other_line(d.get("other_source"))
    if other:
        lines.extend(["", f"> **Demand Context:** {other.strip()}"])
    return "\n".join(lines)


def _stock(d, q):
    if not d["rows"]:
        return f"{d['material']} was not found in your plants."
    parts = []
    for r in d["rows"]:
        s = (f"{d['material']} at {r['plant']}: usable {_q(r['usable'], r['uom'])} (on hand {_q(r['on_hand'], r['uom'])}, "
             f"allocated {_q(r['allocated'])}, blocked {_q(r['blocked'])}, QC hold {_q(r['qc_hold'])}), safety stock "
             f"{_q(r['ss'])}, max {_q(r['max'])}; status {r['status'].replace('_', ' ')}")
        if r["shortage_date"]:
            s += f", below safety stock on {day(r['shortage_date'])}"
        if r["stockout_date"]:
            s += f", stock-out on {day(r['stockout_date'])}"
        s += f"; lead time {r['lt_days']} days ({r['lt_source']})."
        parts.append(s)
    return " ".join(parts)


def _shortage(d, q):
    if d["count"] == 0:
        return f"**No material × plant pair** goes below safety stock within {d['days']} days." + other_line(d.get("other_source"))
    rows = d["rows"]
    so = [r for r in rows if r["stockout_date"]]
    crit = d['by_status'].get('critical', 0)
    risk = d['by_status'].get('at_risk', 0)
    
    lines = [
        f"### ⚠️ Material Shortage Forecast (Next {d['days']} Days)",
        f"**{d['count']} material × plant pairs** go below safety stock within {d['days']} days (**{crit} critical**, **{risk} at risk).",
        f"🚨 **{d['with_stockout']} of them reach a stock-out**, where production lines would stop.",
        "",
        "#### Most Urgent Materials at Risk:",
        "| Material & Plant | Status | Shortage Gap | Below Safety Stock | Projected Stock-Out | Impacted Orders |",
        "| :--- | :--- | :--- | :--- | :--- | :--- |",
    ]
    for r in (so or rows)[:5]:
        st = r['status'].replace('_', ' ').title()
        badge = "🔴 " + st if 'critical' in r['status'].lower() else "🟡 " + st
        gap = _q(r.get('short_qty'), r.get('uom'))
        ss_date = day(r['shortage_date']) if r['shortage_date'] else '—'
        so_date = day(r['stockout_date']) if r['stockout_date'] else 'None'
        orders = f"{r['orders_affected']} orders" if r.get('orders_affected') else '—'
        mat_plant = f"**{r['material']}** @ {r['plant']}"
        lines.append(f"| {mat_plant} | {badge} | **{gap}** | {ss_date} | {so_date} | {orders} |")
    
    other = other_line(d.get("other_source"))
    if other:
        lines.extend(["", f"> **Demand Context:** {other.strip()}"])
        
    return "\n".join(lines)


def _rank(d, q):
    lines = [
        "### 🚨 Highest Risk Materials Ranking",
        "| Rank | Material & Plant | Status | Below SS In | Projected Stock-Out |",
        "| :--- | :--- | :--- | :--- | :--- |",
    ]
    for i, r in enumerate(d["rows"]):
        st = r['status'].replace('_', ' ').title()
        badge = "🔴 " + st if 'critical' in r['status'].lower() else "🟡 " + st
        so_date = day(r['stockout_date']) if r['stockout_date'] else 'None'
        lines.append(f"| #{i + 1} | **{r['material']}** @ {r['plant']} | {badge} | {r['days']} days | {so_date} |")
    return "\n".join(lines)


def _excess(d, q):
    lines = [
        f"### 💰 Excess Inventory & Cash Impact",
        f"**{inr(d['excess_value_inr'])}** is tied up above maximum stock across **{d['excess_pairs']}** material × plant pairs.",
    ]
    if d["rows"]:
        lines.extend([
            "",
            "| Material & Plant | Excess Quantity | Value Above Max |",
            "| :--- | :--- | :--- |",
        ])
        for r in d["rows"]:
            lines.append(f"| **{r['material']}** @ {r['plant']} | {_q(r['excess_qty'], r['uom'])} | {inr(r['excess_value_inr'])} |")
    if d["no_demand_basis"]:
        lines.extend([
            "",
            f"⚠️ Another **{inr(d['no_demand_basis_value_inr'])}** sits in consumables with no demand basis (cannot judge whether needed). Max stock is derived (A14).",
        ])
    return "\n".join(lines)


def _expiry(d, q):
    lots = "; ".join(f"{_pair(r)} lot {r['lot']} expires {day(r['expiry'])} ({r['days_to_expiry']} days, {inr(r['value_inr'])})"
                     for r in d["lots_with_expiry"][:4])
    return (f"Nothing expires within {d['days']} days ({inr(d['expiring_value_inr'])} at risk). Only "
            f"{d['lots_with_expiry_total']} lots carry an expiry date, all consumables; the earliest: {lots}. "
            "Consumables have no demand basis, so waste risk cannot be judged (A13, A17)."
            if d["expiring_count"] == 0 else
            f"{d['expiring_count']} lots expire within {d['days']} days, worth {inr(d['expiring_value_inr'])}: {lots}.")


def _prop_line(p: dict) -> str:
    who = f"from {p['source_plant']}" if p["kind"] == "transfer" else f"from {p['supplier'] or 'a supplier to be assigned (A11)'}"
    c = p.get("calc", {})
    s = (f"{p['no']} ({p['kind']}, {p['state'].replace('_', ' ')}): {_q(p['qty'], p['uom'])} of {p['material']} for "
         f"{p['plant']} {who}, {inr(p['value_inr'])}, needed by {day(p['needed_by'])}")
    if "target_qty" in c:
        s += (f"; target {_q(c['target_qty'])} minus projected {_q(c['projected_at_arrival_qty'])} at arrival = "
              f"gap {_q(c['gap_qty'])}")
        if c.get("moq_applied"):
            s += f", raised to the MOQ of {_q(c['moq_qty'])}"
    return s + ("; needs the procurement manager too (above threshold)" if p["level"] == 2 else "; purchasing officer approval only")


def _replen(d, q):
    if not d["proposals"]:
        return f"There is no open proposal for {d['material']} at {d['plant']} — its projected stock covers the target."
    return " ".join(_prop_line(p) + "." for p in d["proposals"])


def _transfer(d, q):
    src = "; ".join(f"{s['source']} ({s['source_status'].replace('_', ' ')}, headroom {_q(s['headroom_over_horizon'])}) — "
                    f"{'eligible' if s['eligible'] else 'not eligible: ' + s['why']}" for s in d["sources"])
    tp = d["transfer_proposal"]
    return (f"Transfer options for {d['material']} to {d['to_plant']}: {src or 'no other plant'}."
            + (f" Proposed: {_prop_line(tp)}." if tp else ""))


def _sim(d, q):
    if not d["results"]:
        return "No open PO lines for that supplier in your plants."
    out = []
    for r in d["results"]:
        rows = "; ".join(f"{x['material']} at {x['plant']} status {x['status'].replace('->', ' → ')}, below SS {x['shortage'].replace('->', ' → ').replace('None', 'none')}, "
                         f"stock-out {x['stockout'].replace('->', ' → ').replace('None', 'none')}" for x in r["rows"][:3])
        out.append(f"{r['supplier']} {d['delay_days']} days late: {r['pairs_worse']} of {r['pairs_with_delayed_supply']} "
                   f"supplied pairs get worse, {r['newly_critical']} newly critical, {r['new_stockouts']} new stock-outs"
                   + (f" ({rows})" if rows else "") + ".")
    lead = "" if d["suppliers_tested"] == 1 else f"Tested all {d['suppliers_tested']} suppliers; worst first. "
    return lead + " ".join(out)


def _proposals(d, q):
    if "error" in d:
        return d["error"]
    if "no" in d:
        tl = "; ".join(f"{x['action']} → {x['to'].replace('_', ' ')} by {x['by']}" for x in d.get("timeline", []))
        return _prop_line(d) + "." + (f" History: {tl}." if tl else " No decisions yet.")
    if d["count"] == 0:
        return (f"Nothing is waiting for your approval. {d['drafts']} draft proposals ({inr(d['drafts_value_inr'])}) "
                "have not been submitted yet.")
    rows = "; ".join(_prop_line(p) for p in d["rows"][:5])
    return (f"{d['count']} proposals ({inr(d['value_inr'])}) wait for approval ({', '.join(s.replace('_', ' ') for s in d['waiting_states'])}). "
            f"{rows}." + (f" And {d['more']} more." if d["more"] else ""))


def _dq(d, q):
    items = "; ".join(f"{c['check']} ({c['severity']}, {c['affected']})" for c in d["checks"])
    return (f"{d['issues_found']} data-quality issues were found before calculation; data is {d['data_age_days']} days old. "
            f"{items}.")


def _compare_quotes(d, q):
    winner = d["recommended_supplier"]
    lines = [
        f"### 🏷️ Supplier Quote Comparison: {d['material_name']} ({d['material_id']})",
        f"Evaluated **{len(d['suppliers'])} approved suppliers** for an order requirement of **{d['required_qty']} units**:",
        "",
        "| Supplier | Quoted Price | Landed Total | Lead Time | OTIF % | Quality % | Score | Recommendation |",
        "| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |",
    ]
    for s in d["suppliers"]:
        rec = "🏆 **Best Value**" if s.get("is_recommended") else f"Rank #{s.get('rank', '-')}"
        lines.append(
            f"| **{s['supplier_name']}** | {inr(s['unit_price_inr'])} | {inr(s['total_landed_cost_inr'])} | "
            f"{s['lead_time_days']} days | {s['on_time_rate_pct']}% | {s['quality_acceptance_pct']}% | "
            f"**{s['recommendation_score']}/100** | {rec} |"
        )
    lines.extend([
        "",
        f"> **Procurement Rationale:** {d['recommendation_rationale']}",
    ])
    return "\n".join(lines)


def _capacity(d, q):
    if not d.get("products"):
        return f"No production capacity data found for {d.get('plant_id', 'plant')}."
    lines = [
        f"### 🏭 Production Build Capacity & Bottleneck Analysis",
        f"Plant: **{d.get('plant_id', 'All Plants')}** | Total Assembly Capacity: **{d.get('total_buildable_units', 0):,} units**",
        "",
        "| Product | Max Buildable Capacity | Protected Capacity (Above SS) | Limiting Bottleneck Component | Available Usable Stock |",
        "| :--- | :--- | :--- | :--- | :--- |",
    ]
    for p in d["products"]:
        lim_mat = f"**{p['bottleneck_material']}**" + (f" (`{p['bottleneck_material_id']}`)" if p.get('bottleneck_material_id') else "")
        lim_stock = f"{p.get('limiting_usable_stock', '—'):,} EA" if p.get('limiting_usable_stock') is not None else "—"
        lines.append(f"| **{p['product_name']}** (`{p['product_id']}`) | **{p['max_capacity']:,} units** | {p.get('protected_capacity', 0):,} units | {lim_mat} | {lim_stock} |")
    
    for p in d["products"]:
        if p.get("top_constraints"):
            cs = ", ".join(f"{c['material_name']} ({c['usable_stock']:,} {c['uom']} → max {c['supported_capacity']:,} units)" for c in p["top_constraints"])
            lines.extend(["", f"> **Component Constraints for {p['product_name']}:** {cs}."])
    return "\n".join(lines)


_RENDER = {"get_daily_brief": _brief, "get_inventory_overview": _overview, "get_stock_position": _stock,
           "get_shortage_horizon": _shortage, "get_material_risk_ranking": _rank, "get_excess_inventory": _excess,
           "get_expiring_lots": _expiry, "get_replenishment_options": _replen, "get_transfer_options": _transfer,
           "simulate_shortage_impact": _sim, "get_proposal_details": _proposals, "get_data_quality": _dq,
           "compare_supplier_quotes": _compare_quotes, "get_production_capacity": _capacity}
