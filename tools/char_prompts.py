import json, sys
A = r"C:\Users\ndh10\Documents\relic-raiders-quarter\contest\미니유물레이더스\assets"
refs = [A + r"\art_brawler.jpg", A + r"\art_sniper.jpg"] if "--alt" in sys.argv else [A + r"\art_rifle.jpg", A + r"\art_scout.jpg"]
STYLE = ("A brand new character drawn in exactly the same 3D art style, proportions, materials and render as the reference characters (image 1 and image 2): "
         "chunky smooth vinyl-toy shapes, slightly large blocky head, simple black dot eyes, matte dark navy and charcoal with white panels, glowing neon cyan accent lines, "
         "a few small paint dots in cyan, magenta and yellow. Full body from head to boots, standing upright facing the camera in a three-quarter front view, neutral A-pose, "
         "arms held straight and slightly away from the body, empty open hands, legs slightly apart. Plain flat light grey studio background, soft even lighting, no ground, no shadow, no text, no weapon, only one character. "
         "It must be a different character from the references, not a copy. The new character: ")
C = {
  "inventor": "a cheerful kid inventor with a fully visible smiling face, messy short brown hair, big round brass-rimmed goggles pushed up on the forehead, a short white lab coat, a tool belt with a wrench, a small backpack with a tiny folded mechanical arm, sturdy boots.",
  "robot": "a friendly little robot buddy with a rounded boxy navy helmet head and a big glossy black screen face showing two glowing cyan dot eyes and a small smile, one short antenna with a glowing ball tip, a white rounded chest plate with a round glowing core, chunky round shoulders, mitten robot hands, short legs with big round feet.",
  "wizard": "a young wizard student with a fully visible bare smiling face (no goggles, no glasses, nothing over the eyes), a navy pointed wizard hood with a small glowing cyan star at the tip, a short white cape with cyan trim over the shoulders, a belt with a small round potion bottle, a thick book strapped on the back, soft boots.",
  "kitty": "a sporty girl with a fully visible smiling face and rosy cheeks, wearing a navy hoodie with two cat ears on the hood and a glowing cyan zipper, big chunky white headphones around the neck, a short skirt over leggings, chunky gloves, high-top sneakers.",
  "knight": "a little knight with a rounded navy knight helmet with an open face and no visor, no goggles, no glasses, showing a fully visible bare smiling face, a short white plume on top, white chest armor with a glowing cyan emblem, rounded shoulder pads, a round shield strapped on the back, armored boots.",
}
sys.argv = [a for a in sys.argv if a != "--alt"]; seeds = [int(s) for s in sys.argv[2].split(",")] if len(sys.argv) > 2 else [1, 2, 3]
names = sys.argv[3].split(",") if len(sys.argv) > 3 else list(C)
jobs = [{"name": f"{n}_s{s}", "seed": s, "w": 896, "h": 1152, "refs": refs, "prompt": STYLE + C[n]} for n in names for s in seeds]
json.dump(jobs, open(sys.argv[1], "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(len(jobs), "jobs")

