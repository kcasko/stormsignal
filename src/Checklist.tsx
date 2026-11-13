import { useEffect, useState } from "react";
import type { Weather } from "../shared/types";
type Saved = { pets: boolean; medical: boolean; done: string[] };
const blank: Saved = { pets: false, medical: false, done: [] };
function load(): Saved {
  try {
    const v = JSON.parse(localStorage.getItem("stormsignal-prep-v1") || "null");
    if (
      v &&
      typeof v.pets === "boolean" &&
      typeof v.medical === "boolean" &&
      Array.isArray(v.done)
    )
      return {
        ...v,
        done: v.done.filter((x: unknown) => typeof x === "string").slice(0, 30),
      };
  } catch {}
  return blank;
}
export function Checklist({ weather }: { weather: Weather | null }) {
  const [saved, setSaved] = useState(load);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem("stormsignal-prep-v1", JSON.stringify(saved));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [saved]);
  const winter = weather?.periods.some((p) =>
    /snow|freez|sleet/i.test(p.forecast),
  );
  const tasks = [
    [
      "alerts",
      "Keep official alerts on",
      "Use more than one way to receive warnings.",
    ],
    [
      "shelter",
      "Choose a sturdy shelter",
      "Make sure everyone knows where to go.",
    ],
    ["power", "Charge essential devices", "Keep a flashlight within reach."],
    ...(winter
      ? [
          [
            "winter",
            "Review heating and travel plans",
            "Use safe heat sources. Never run a generator indoors.",
          ],
        ]
      : [
          [
            "outside",
            "Secure loose outdoor items",
            "Only before storms arrive and if conditions allow.",
          ],
        ]),
    ...(saved.pets
      ? [
          [
            "pets",
            "Bring pets and carriers indoors",
            "Keep leashes and supplies nearby.",
          ],
        ]
      : []),
    ...(saved.medical
      ? [
          [
            "medical",
            "Review your equipment backup plan",
            "Follow your provider’s plan and arrange support early.",
          ],
        ]
      : []),
  ];
  const count = tasks.filter((t) => saved.done.includes(t[0])).length;
  return (
    <section id="prepare">
      <div className="sectiontop">
        <span className="num">YOUR HOUSEHOLD</span>
        <button id="reset" onClick={() => setSaved({ ...blank, done: [] })}>
          Reset
        </button>
      </div>
      <h2>Get ready.</h2>
      <p className="small">Choose what belongs in your plan.</p>
      <div className="profile">
        <label>
          <input
            type="checkbox"
            checked={saved.pets}
            onChange={(e) => setSaved({ ...saved, pets: e.target.checked })}
          />
          Pets
        </label>
        <label>
          <input
            type="checkbox"
            checked={saved.medical}
            onChange={(e) => setSaved({ ...saved, medical: e.target.checked })}
          />
          Powered medical equipment
        </label>
      </div>
      <div className="small" aria-live="polite">
        {count} of {tasks.length} preparation steps checked
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label="Checklist completion"
        aria-valuemin={0}
        aria-valuemax={tasks.length}
        aria-valuenow={count}
      >
        <div style={{ width: (count / tasks.length) * 100 + "%" }} />
      </div>
      <div id="tasks">
        {tasks.map(([id, title, sub]) => (
          <label className="task" key={id}>
            <input
              type="checkbox"
              checked={saved.done.includes(id)}
              onChange={(e) =>
                setSaved({
                  ...saved,
                  done: e.target.checked
                    ? [...saved.done, id]
                    : saved.done.filter((x) => x !== id),
                })
              }
            />
            <span className="tasktext">
              {title}
              <small>{sub}</small>
            </span>
          </label>
        ))}
      </div>
      <p className="small">
        {storageError
          ? "Browser storage unavailable; changes last only in this tab."
          : "Preferences and checked tasks stay in this browser until reset."}{" "}
        A completed checklist does not mean you are safe. During a warning,
        protective instructions come first.
      </p>
    </section>
  );
}
