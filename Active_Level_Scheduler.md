Help me implement these active level schedule patterns:

1. None -- all levels are active
2. Rampup -- Active level starts from lowest resolution then move up the ladder and keep at the highest resolution level
3. V cycle -- Active level starts from highest resolution leve then move down to the lowerest and up then keep all levels active
4. W cycle -- The same down-up and in V cycle but then cycle throughout

Please also add a args.level_steps which controls the steps stay at each level for the full level sheduler scheme, i.e., all steps in the individual scheme defaults to this arg
