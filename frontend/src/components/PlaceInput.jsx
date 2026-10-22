import React, { useEffect, useRef, useState } from "react";
import { geocode } from "../api.js";
import { Icon } from "./Icons.jsx";

/**
 * Accessible place autocomplete input with keyboard navigation and clear button.
 */
export default function PlaceInput({ id, label, icon = "map-pin", value, placeholder = "Search city or address...", onChange }) {
  const [text, setText] = useState(value?.label || "");
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    setText(value?.label || "");
  }, [value]);

  useEffect(() => {
    if (text.length < 3 || value?.label === text) {
      setOptions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { results } = await geocode(text, ctrl.signal);
        setOptions(results || []);
        setOpen((results || []).length > 0);
        setActiveIndex(-1);
      } catch {
        // Aborted or temporary error; keep current state
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [text, value]);

  function handleSelect(item) {
    setText(item.label);
    onChange(item);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function handleClear() {
    setText("");
    onChange(null);
    setOptions([]);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (!open || options.length === 0) {
      if (e.key === "ArrowDown" && options.length > 0) {
        setOpen(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1 < options.length ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 >= 0 ? prev - 1 : options.length - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < options.length) {
        e.preventDefault();
        handleSelect(options[activeIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className="field-group place-field">
      <div className="field-label-row">
        <label htmlFor={id} className="field-label">
          <Icon name={icon} size={14} className="label-icon" />
          <span>{label}</span>
        </label>
        {value?.lat && value?.lon && (
          <span className="coord-tag" title={`Coordinates: ${value.lat.toFixed(4)}, ${value.lon.toFixed(4)}`}>
            {value.lat.toFixed(2)}°, {value.lon.toFixed(2)}°
          </span>
        )}
      </div>

      <div className="input-wrap">
        <input
          ref={inputRef}
          id={id}
          type="text"
          className="text-input"
          value={text}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls={`${id}-suggestions`}
          aria-activedescendant={activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined}
          onChange={(e) => {
            setText(e.target.value);
            onChange(null);
          }}
          onFocus={() => {
            if (options.length > 0) setOpen(true);
          }}
          onBlur={() => {
            // Delay closing to allow clicks on suggestion options to register
            setTimeout(() => setOpen(false), 200);
          }}
          onKeyDown={handleKeyDown}
        />

        <div className="input-suffix">
          {loading && <span className="mini-spinner" aria-label="Searching locations" />}
          {text && !loading && (
            <button
              type="button"
              className="clear-input-btn"
              onClick={handleClear}
              aria-label={`Clear ${label}`}
              title="Clear location"
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
      </div>

      {open && options.length > 0 && (
        <ul
          id={`${id}-suggestions`}
          ref={listRef}
          className="suggestions-list"
          role="listbox"
          aria-label={`${label} suggestions`}
        >
          {options.map((opt, idx) => {
            const isSelected = activeIndex === idx;
            return (
              <li
                key={`${opt.lat}-${opt.lon}-${idx}`}
                id={`${id}-opt-${idx}`}
                role="option"
                aria-selected={isSelected}
                className={`suggestion-item ${isSelected ? "active" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(opt);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                <Icon name="map-pin" size={14} className="sugg-pin-icon" />
                <span className="sugg-label">{opt.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
