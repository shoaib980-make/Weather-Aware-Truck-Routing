import { useEffect, useState } from "react";
import { geocode } from "../api.js";

/** Text input with debounced place suggestions. Calls onChange(place | null). */
export default function PlaceInput({ id, label, value, onChange }) {
  const [text, setText] = useState(value?.label || "");
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => setText(value?.label || ""), [value]);

  useEffect(() => {
    if (text.length < 3 || value?.label === text) return setOptions([]);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { results } = await geocode(text, ctrl.signal);
        setOptions(results);
        setOpen(true);
      } catch {
        /* aborted or service busy: ignore, user can keep typing */
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [text, value]);

  return (
    <div className="field place">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={text}
        autoComplete="off"
        placeholder="City or address"
        onChange={(e) => {
          setText(e.target.value);
          onChange(null);
        }}
        onFocus={() => options.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && options.length > 0 && (
        <ul className="suggestions" role="listbox">
          {options.map((o) => (
            <li key={`${o.lat},${o.lon}`} role="option" onMouseDown={() => { onChange(o); setOpen(false); }}>
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
