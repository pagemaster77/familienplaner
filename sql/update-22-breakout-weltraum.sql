-- Update 22 (bereits eingespielt): Spielhalle: Pong und Reaktion durch Breakout 2 und Weltraum-Abwehr ersetzt.
-- arcade_scores.game erlaubt zusaetzlich 'breakout' und 'weltraum' (alte Werte pong/reaktion bleiben erhalten).
-- submit_score: breakout/weltraum 0..60000 Punkte -> Spielpunkte min(score/50, 300). Die Zweige pong/reaktion bleiben bestehen.
alter table arcade_scores drop constraint arcade_scores_game_check;
alter table arcade_scores add constraint arcade_scores_game_check check (game = any (array['snake','memory','reaktion','flappy','frogger','pong','farben','bonbon','code','breakout','weltraum']));
-- (Funktion submit_score: siehe Migration "spielhalle_breakout_weltraum" in Supabase)
-- Nachtrag 27.11.: Obergrenze fuer breakout/weltraum von 60000 auf 5000000 Punkte erhoeht (Weltraum-Abwehr hat kein Ende,
-- ein Spieler erreichte 178775 Punkte und wurde als "Unmoegliches Ergebnis" abgelehnt). Spielpunkte bleiben bei max. 300.
