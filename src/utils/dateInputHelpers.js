/** Today's date as YYYY-MM-DD in the viewer's local timezone (not UTC) — safe for a date input's `min`. */
export function todayLocalDateInputValue() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
