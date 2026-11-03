# Audio log - 말랑 퀴즈 파티

- 2026-11-04 started. Tool: Agent Audio / Stable Audio 3 Medium (tflite backend, portable CPU path; no GPU used), ffmpeg 9.0.2, numpy+soundfile (Agent Audio runtime venv) for analysis/processing. Raw WAVs + scripts in %TEMP%\partyaudio\ (raw\, sfxwav\, bgmwav\, proc_sfx.py, proc_bgm.py, norm_bgm.ps1, analyze.py, pitch.py, seam.py).
- 28 SFX raw WAVs generated (1-3 s each), plus 3 retakes: jump_b (first take had two separate events over 2.7 s), back_b (first take was a 50 ms tick, not a "soft" back), go (old kart go.mp3 was a plain 2 kHz beep, not whistle+pop).

## Reused from the earlier game (scratch-2026-11-03-d3e9ba/assets/audio/sfx)
- click.mp3, hover.mp3, coin.mp3, purchase.mp3 copied unchanged.
- count.mp3: the old file holds two beeps 1 s apart; only the first beep (0-0.2 s) was kept, peak -8 dB, short fade.
- Not reused: go (beep, not whistle+pop), star/whoosh (regenerated in a softer cute style).

## SFX processing (mono, 44.1 kHz, mp3 128k)
- DC removed, leading silence trimmed (-40 dB rel. peak, 3 ms pre-roll), tail trimmed at -50 dB rel. peak, 2 ms fade-in, 18 ms linear fade-out. Where a per-sound length cap cut a sound before its natural end (dive, correct, wrong, bounce, launch, hit, dizzy, cheer, crown, round_start, round_end), a longer squared fade (30-350 ms) was used instead to avoid an abrupt stop.
- Peak normalisation: -3 dBFS default; back/whoosh/land/slide/cheer -4; dizzy -5; tick -6; wrong -7 (kept soft); fall/count -8 (sustained tones read loud); step -12 (quiet patter).
- Durations (s): back 0.14, whoosh 0.39, star 1.79, count 0.20, go 1.18, jump 0.46, land 0.36, dive 0.90, slide 1.04, bonk 0.72, door_burst 2.24, correct 1.00, wrong 0.80, splash 0.81, respawn 1.56, bounce 0.80, launch 1.40, hit 0.45, tick 0.07, tile_crack 1.58, tile_drop 1.09, balloon_pop 1.53, ink 1.29, dizzy 1.20, cheer 2.20, crown 2.40, round_start 1.70, round_end 2.35, step 0.17, fall 1.12; reused click 0.02, hover 0.01, coin 0.30, purchase 0.78.
- Checks (volumedetect on final mp3s): none silent, none clipped (max -1.8 .. -21 dBFS by design). Rough spectral checks: fall and tile_drop descend in pitch, correct/bounce/launch/jump rise, wrong is low (~380-500 Hz).

## BGM (stereo 44.1 kHz, mp3 160k)
- Generated 90 s each (result 75 s). Prompts: title = bright bouncy kids party pop 120 BPM (ukulele, glockenspiel, synth bass, claps); menu = calm cheerful marimba/pizzicato/kalimba 100 BPM; round_a = quirky energetic party 132 BPM (slap bass, brass stabs, xylophone, woodblocks); round_b = playful quiz-show groove 112 BPM (ticking hats, pizzicato, light tension); final = fast exciting 150 BPM (drums, brass fanfares, orchestral hits, cute); result = celebratory brass/glockenspiel fanfare loop 124 BPM.
- Loop construction: loop start = one of the 12 strongest onsets in 1.5-9 s (skips generator intro); loop end chosen in the last 26 s (before the generator fade-out, loop >= 60 s) by best correlation of onset envelope + 24-band log spectrum around start/end; last 1.0 s equal-power crossfaded with the audio just before the loop start, so the wrap is continuous.
  - title 8.98-80.97 s (72.0 s, match 0.55/0.59), menu 3.27-80.07 (76.8, 0.97/0.98), round_a 8.41-73.86 (65.5, 0.83/0.57), round_b 3.67-74.39 (70.7, 0.73/0.58), final 8.20-79.40 (71.2, 0.65/0.58), result 2.88-68.69 (65.8, 0.73/0.68).
- Loudness: two-pass ffmpeg loudnorm (linear) to -18 LUFS, TP -1.5; round_a would have gone into dynamic mode (bad for loop seams) so it got a plain linear -0.2 dB gain instead. ebur128 on final mp3s: all -18.4 LUFS integrated; peaks title -2.4, menu -4.9, round_a -0.8, round_b -3.4, final -3.5, result -5.8 dBFS.
- Seam check on decoded mp3s: sample jump at the wrap 0.002-0.045 vs 99.9th-percentile in-track jump 0.10-0.28 (no click); 1 s RMS either side of the wrap within ~1-4 dB.

## Limits
- Nothing was auditioned by ear; prompt adherence/musical quality and how smooth the crossfaded loops sound are unverified (title/final/round_b start-vs-end similarity only moderate, so the 1 s crossfade may be audible as a phrase change). Generator tempo is approximate.
- MP3 encoder delay: loop seamlessly with Web Audio (AudioBufferSourceNode.loop) rather than <audio loop>.
- manifest: assets/audio/manifest.json (ext .mp3, 34 sfx, 6 bgm).
