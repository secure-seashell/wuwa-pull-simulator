// Game configurations
const GAME_CONFIGS = {
    wuwa: {
        name: 'Wuthering Waves',
        currency: { primary: 'Astrites', secondary: 'Corals' },
        currencyMultiplier: 160, // Astrites per pull
        secondaryCost: 8, // Corals per pull
        sequenceCost: 370, // Corals per sequence
        banners: {
            character: {
                pity: 80,
                softPityStart: 66,
                baseRate: 0.008,
                softPityRates: [
                    { start: 66, rate: 0.04 },
                    { start: 71, rate: 0.08 },
                    { start: 76, rate: 0.09 }
                ],
                guaranteeRate: 0.5,
                aRankRate: 0.06,
                aRankGuaranteeRate: 0.5,
                aRankPity: 10,

                corals: {
                    aRank: 3,
                    aRankMax: 8,
                    sRankStandard: 30,
                    sRankDupeMax: 25,
                    sRankDupe: 0,
                    sRank: 15
                }
            },
            weapon: {
                pity: 80,
                softPityStart: 66,
                baseRate: 0.008,
                softPityRates: [
                    { start: 66, rate: 0.04 },
                    { start: 71, rate: 0.08 },
                    { start: 76, rate: 0.09 }
                ],
                guaranteeRate: 1.0,
                aRankRate: 0.06,
                aRankGuaranteeRate: 0.5,
                aRankPity: 10,

                corals: {
                    aRank: 3,
                    aRankMax: 3,
                    sRankStandard: 0,
                    sRankDupeMax: 0,
                    sRankDupe: 0,
                    sRank: 15
                }
            }
        },
        tooltips: {
            aRankTier: 'A-rank Characters at S0 vs S6',
            sRankTier: 'Standard S-rank Characters at S0 vs S6'
        },
        methodology: {
            softPityText: '4% per pull starting at pull 66, 8% at 71, 9% at 76, experimentally observed on <a href="https://wuwatracker.com/" target="_blank">wuwatracker.com</a>.',
            sequenceText: 'When spending corals on sequences, after winning the desired character, 370 corals are spent to buy a sequence if available. Corals are not spent at any other time.',
            pullText: 'When spending corals on pulls, 8 corals are always spent if available. These are not counted in the final pull count.'
        }
    },
    zzz: {
        name: 'Zenless Zone Zero',
        currency: { primary: 'Polychromes', secondary: 'Signals' },
        currencyMultiplier: 160, // Polychromes per pull
        secondaryCost: 20, // Signals per pull
        sequenceCost: null, // Cannot buy mindscapes
        banners: {
            character: {
                pity: 90,
                softPityStart: 76,
                baseRate: 0.006,
                softPityRates: [
                    { start: 76, rate: 0.06 }
                ],
                guaranteeRate: 0.5,
                aRankRate: 0.094,
                aRankGuaranteeRate: 0.5,
                aRankPity: 10,

                corals: {
                    aRank: 8,
                    aRankMax: 20,
                    sRankStandard: 0,
                    sRankDupeMax: 100,
                    sRankDupe: 40,
                    sRank: 0
                }
            },
            weapon: {
                pity: 80,
                softPityStart: 66,
                baseRate: 0.01,
                softPityRates: [
                    { start: 66, rate: 0.06 }
                ],
                guaranteeRate: 0.75,
                aRankRate: 0.15,
                aRankGuaranteeRate: 0.75,
                aRankPity: 10,

                corals: {
                    aRank: 8,
                    aRankMax: 8,
                    sRankStandard: 0,
                    sRankDupeMax: 0,
                    sRankDupe: 0,
                    sRank: 40
                }
            }
        },
        tooltips: {
            aRankTier: 'A-rank Characters at M0 vs M6',
            sRankTier: 'Standard S-rank Characters at M0 vs M6'
        },
        methodology: {
            softPityText: '6% per pull starting at pull 76 for character banner, 66 for weapon banner, based on community data.',
            sequenceText: null,
            pullText: 'When spending signals on pulls, 20 signals are always spent if available. These are not counted in the final pull count.'
        }
    }
};

class GachaSimulator {
    constructor() {
        this.chart = null;
        this.annotationAvailable = false;
        this.currentGame = 'wuwa';
        this.gameConfig = GAME_CONFIGS[this.currentGame];
        this.initializeAnnotations();
        this.setupEventListeners();
        this.initializeGameTabs();
        this.updateUI();
    }

    initializeAnnotations() {
        // Create custom percentile line plugin
        const percentilePlugin = {
            id: 'percentileLines',
            afterDraw: (chart) => {
                if (!this.currentPercentiles) return;

                const ctx = chart.ctx;
                const chartArea = chart.chartArea;

                const percentileConfig = [
                    { p: 1, color: '#9CA3AF', opacity: 0.7, lineWidth: 1, dash: [2, 3] },
                    { p: 10, color: '#6B7280', opacity: 0.8, lineWidth: 1.5, dash: [3, 3] },
                    { p: 25, color: '#4B5563', opacity: 0.9, lineWidth: 2, dash: [4, 4] },
                    { p: 50, color: '#FF6B35', opacity: 1, lineWidth: 3, dash: [] },
                    { p: 75, color: '#F7931E', opacity: 1, lineWidth: 2.5, dash: [5, 5] },
                    { p: 90, color: '#DC143C', opacity: 1, lineWidth: 2.5, dash: [5, 5] },
                    { p: 99, color: '#B91C1C', opacity: 0.9, lineWidth: 2, dash: [3, 3] }
                ];

                percentileConfig.forEach(({ p, color, opacity, lineWidth, dash }) => {
                    const value = this.currentPercentiles[p];
                    if (!value) return;

                    // Find x position for this value
                    const xPos = this.getXPositionForValue(chart, value);
                    if (xPos === null) return;

                    // Draw line
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    ctx.strokeStyle = color;
                    ctx.lineWidth = lineWidth;
                    ctx.setLineDash(dash);
                    ctx.beginPath();
                    ctx.moveTo(xPos, chartArea.top);
                    ctx.lineTo(xPos, chartArea.bottom);
                    ctx.stroke();

                    // Draw label - align all at top of chart with horizontal offsets to avoid overlap
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = color;
                    ctx.font = p === 50 ? 'bold 11px Arial' : '10px Arial';

                    const isAstrites = this.currentDisplayMode === 'astrites';
                    const displayValue = isAstrites ? Math.round(value).toLocaleString() : value;
                    const label = `${p}%: ${displayValue}`;

                    // Align all labels at the top of the chart area
                    const labelY = chartArea.top + 12;

                    // Offset labels horizontally to prevent overlap
                    let labelX = xPos;
                    let textAlign = 'center';

                    // Adjust positioning based on percentile to avoid overlaps
                    if (p === 1) { labelX = xPos - 15; textAlign = 'right'; }
                    else if (p === 10) { labelX = xPos - 10; textAlign = 'right'; }
                    else if (p === 25) { labelX = xPos - 5; textAlign = 'right'; }
                    else if (p === 75) { labelX = xPos + 5; textAlign = 'left'; }
                    else if (p === 90) { labelX = xPos + 10; textAlign = 'left'; }
                    else if (p === 99) { labelX = xPos + 15; textAlign = 'left'; }

                    ctx.textAlign = textAlign;
                    ctx.fillText(label, labelX, labelY);

                    ctx.restore();
                });
            }
        };

        Chart.register(percentilePlugin);
        this.annotationAvailable = true;
    }

    setupEventListeners() {
        document.getElementById('runSimulation').addEventListener('click', () => {
            this.runSimulation();
        });

        // Handle display mode changes
        this.attachDisplayModeEventListeners();
    }

    attachDisplayModeEventListeners() {
        const displayModeRadios = document.querySelectorAll('input[name="displayMode"]');
        displayModeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                this.updateDisplayMode();
            });
        });
    }

    updateDisplayMode() {
        // Re-display results with new mode if we have results
        if (this.lastResults) {
            this.displayResults(this.lastResults);
        }

        // Also update the chart display mode tracking
        const displayModeElement = document.querySelector('input[name="displayMode"]:checked');
        if (displayModeElement) {
            const isAstrites = displayModeElement.value === 'astrites';
            this.currentDisplayMode = isAstrites ? 'astrites' : 'pulls';
        }
    }

    getParameters() {
        const coralModeElement = document.querySelector('input[name="coralMode"]:checked');
        const coralMode = coralModeElement ? coralModeElement.value : 'none'; // Default to 'none' if nothing selected
        const weaponHasGuarantee = this.gameConfig.banners.weapon.hasGuarantee;

        let guaranteed, weaponGuaranteed, characterGuaranteed;

        if (weaponHasGuarantee) {
            // Separate guarantee selectors
            characterGuaranteed = document.querySelector('input[name="characterGuaranteed"]:checked')?.value === 'true' || false;
            weaponGuaranteed = document.querySelector('input[name="weaponGuaranteed"]:checked')?.value === 'true' || false;
            guaranteed = characterGuaranteed; // For backward compatibility in character banner
        } else {
            // Single guarantee selector (applies to character only)
            guaranteed = document.querySelector('input[name="guaranteed"]:checked')?.value === 'true' || false;
            characterGuaranteed = guaranteed;
            weaponGuaranteed = false; // Weapons are always rate-up in games without weapon guarantees
        }

        return {
            simulations: parseInt(document.getElementById('simulations').value),
            characterPity: parseInt(document.getElementById('characterPity').value),
            weaponPity: parseInt(document.getElementById('weaponPity').value),
            guaranteed: guaranteed,
            characterGuaranteed: characterGuaranteed,
            weaponGuaranteed: weaponGuaranteed,
            weaponTarget: parseInt(document.getElementById('weaponTarget').value),
            characterTarget: parseInt(document.getElementById('characterTarget').value),
            startingCorals: parseInt(document.getElementById('startingCorals').value),
            aRankS0: document.querySelector('input[name="aRankTier"]:checked')?.value === 'm0' || false,
            standardSRankS0: document.querySelector('input[name="sRankTier"]:checked')?.value === 'm0' || false,
            coralMode: coralMode,
            sequenceMode: coralMode === 'sequences'
        };
    }

    calculateProbability(pityCount, bannerConfig) {
        let currentRate = bannerConfig.baseRate;

        // Apply soft pity increases
        for (const softPity of bannerConfig.softPityRates) {
            if (pityCount >= softPity.start) {
                currentRate += softPity.rate * (pityCount - softPity.start + 1);
            }
        }

        return Math.min(currentRate, 1.0); // Cap at 100%
    }

    simulateSingleRun(params) {
        // Run weapon banner first, then character banner
        let weaponResult = { totalPulls: 0, totalARanks: 0, totalCorals: 0 };
        let characterResult = { totalPulls: 0, totalARanks: 0, totalCorals: 0 };

        // For weapon banner, we need to get actual corals, not processed by coral mode
        if (params.weaponTarget > 0) {
            weaponResult = this.simulateBannerRun({
                ...params,
                bannerType: 'weapon',
                config: this.gameConfig.banners.weapon,
                target: params.weaponTarget,
                guaranteed: params.weaponGuaranteed,
                startingCorals: params.startingCorals
                // Use the actual coralMode selected by user
            });
        } else {
            weaponResult.totalCorals = params.startingCorals; // No weapon pulls, keep starting corals
        }

        if (params.characterTarget > 0) {
            characterResult = this.simulateBannerRun({
                ...params,
                bannerType: 'character',
                config: this.gameConfig.banners.character,
                target: params.characterTarget,
                guaranteed: params.characterGuaranteed,
                startingCorals: weaponResult.totalCorals // Use corals from weapon banner
            });
        } else {
            // Only weapons, apply coral mode to weapon result
            characterResult.totalCorals = weaponResult.totalCorals;
        }

        return {
            totalPulls: weaponResult.totalPulls + characterResult.totalPulls,
            totalARanks: weaponResult.totalARanks + characterResult.totalARanks,
            totalCorals: characterResult.totalCorals,
            freePullsEarned: weaponResult.freePullsEarned + characterResult.freePullsEarned
        };
    }

    simulateBannerRun(params) {
        // Use the appropriate starting pity for the banner type
        const startingPity = params.bannerType === 'weapon' ? params.weaponPity : params.characterPity;
        let sPityCount = startingPity;
        let aPityCount = 0; // A-rank pity starts at 0
        let rateUpObtained = 0;
        let actualPulls = 0; // Actual pulls spent (excluding coral reinvestments)
        let totalARanks = 0;
        let totalCorals = params.startingCorals; // Start with initial corals
        let freePullsEarned = 0; // Track free pulls from coral reinvestment
        let sequencesPurchased = 0; // Track sequences purchased with corals
        let isGuaranteed = params.guaranteed; // Track if next S-rank is guaranteed rate-up
        let aIsGuaranteed = false; // Track if next A-rank is guaranteed rate-up (always starts at 50/50)

        while (rateUpObtained < params.target) {
            // Check if we can use corals for a free pull
            let isFreePull = false;
            const shouldReinvest = params.coralMode === 'reinvest';

            if (shouldReinvest && totalCorals >= this.gameConfig.secondaryCost) {
                totalCorals -= this.gameConfig.secondaryCost;
                freePullsEarned++;
                isFreePull = true;
            } else {
                actualPulls++;
            }

            sPityCount++;
            aPityCount++;

            const sRankProbability = this.calculateProbability(sPityCount, params.config);
            const aRankProbability = params.config.aRankRate;
            const rarityResult = Math.random();
            const rateUpResult = Math.random(); // 50/50 etc

            if (rarityResult < sRankProbability) {
                // Got an S-rank, handle differently based on banner type
                let coralsFromSRank = params.config.corals.sRank;

                let gotRateUp = false;

                if (isGuaranteed || rateUpResult < params.config.guaranteeRate) {
                    rateUpObtained++;
                    gotRateUp = true;
                    isGuaranteed = false;
                } else {
                    isGuaranteed = true;
                    coralsFromSRank += params.config.corals.sRankStandard;
                    if (params.standardSRankS0) {
                        coralsFromSRank += params.config.corals.sRankDupe;
                    } else {
                        coralsFromSRank += params.config.corals.sRankDupeMax;
                    }
                }

                totalCorals += coralsFromSRank;

                sPityCount = 0; // Reset S-rank pity after getting S-rank
                aPityCount = 0; // Reset A-rank pity after getting S-rank

                // Check for sequence purchase (only for character banner after getting rate-up)
                // This happens after resetting pity, so we're now at 0 pity and 50/50 state
                if (params.sequenceMode && params.bannerType === 'character' && gotRateUp &&
                    !isGuaranteed) { // At 0 pity and 50/50 state after winning
                    while (this.gameConfig.sequenceCost && totalCorals >= this.gameConfig.sequenceCost && rateUpObtained < params.target) {
                        totalCorals -= this.gameConfig.sequenceCost;
                        rateUpObtained++;
                        sequencesPurchased++;
                    }
                }
            } else if (rarityResult < sRankProbability + aRankProbability || aPityCount >= params.config.aRankPity) {
                totalARanks++;
                let config;
                if (aIsGuaranteed || rateUpResult < params.config.aRankGuaranteeRate) {
                    aIsGuaranteed = false;
                    config = params.config;
                } else { // 50/50 etc loss
                    aIsGuaranteed = true;
                    // 50/50 character vs weapon banner
                    if (Math.random() < 0.5) {
                        config = this.gameConfig.banners.weapon;
                    } else {
                        config = this.gameConfig.banners.character;
                    }
                }
                totalCorals += params.aRankS0 ? config.corals.aRank : config.corals.aRankMax;
                aPityCount = 0;
            }
        }

        return {
            totalPulls: actualPulls,
            totalARanks: totalARanks,
            totalCorals: totalCorals,
            freePullsEarned: freePullsEarned,
            sequencesPurchased: sequencesPurchased
        };
    }

    async runSimulation() {
        const button = document.getElementById('runSimulation');
        const resultsSection = document.getElementById('results');

        button.disabled = true;
        button.classList.add('loading');

        try {
            const params = this.getParameters();

            // Validate that at least one target is specified
            if (params.weaponTarget === 0 && params.characterTarget === 0) {
                alert('Please specify at least one weapon or character target.');
                return;
            }

            const results = [];

            // Run simulations in batches to avoid blocking UI
            const batchSize = 1000;
            const numBatches = Math.ceil(params.simulations / batchSize);

            for (let batch = 0; batch < numBatches; batch++) {
                const currentBatchSize = Math.min(batchSize, params.simulations - batch * batchSize);

                for (let i = 0; i < currentBatchSize; i++) {
                    results.push(this.simulateSingleRun(params));
                }

                // Allow UI to update
                await new Promise(resolve => setTimeout(resolve, 1));

                // Update progress
                button.textContent = `Running... ${Math.round((batch + 1) / numBatches * 100)}%`;
            }

            this.displayResults(results);
            resultsSection.style.display = 'block';
            resultsSection.scrollIntoView({ behavior: 'smooth' });

        } finally {
            button.disabled = false;
            button.classList.remove('loading');
            button.textContent = 'Run Simulation';
        }
    }

    calculateStats(results) {
        const pullCounts = results.map(r => r.totalPulls);
        const aRankCounts = results.map(r => r.totalARanks);
        const coralCounts = results.map(r => r.totalCorals);
        const freePullCounts = results.map(r => r.freePullsEarned);

        const sortedPulls = [...pullCounts].sort((a, b) => a - b);
        const sortedARanks = [...aRankCounts].sort((a, b) => a - b);
        const sortedCorals = [...coralCounts].sort((a, b) => a - b);
        const sortedFreePulls = [...freePullCounts].sort((a, b) => a - b);

        function stats(fieldName) {
            const counts = results.map(r => r[fieldName]);
            const sorted = [...counts].sort((a, b) => a - b);

            return {
                average: counts.reduce((sum, val) => sum + val, 0) / counts.length,
                median: sorted[Math.floor(sorted.length / 2)],
                min: Math.min(...counts),
                max: Math.max(...counts),
                p90: sorted[Math.floor(sorted.length * 0.9)]
            }
        }

        return {
            pulls: stats("totalPulls"),
            aRanks: stats("totalARanks"),
            corals: stats("totalCorals"),
            freePulls: stats("freePullsEarned")
        };
    }

    createHistogram(pullCounts) {
        const min = Math.min(...pullCounts);
        const max = Math.max(...pullCounts);
        const binSize = Math.max(1, Math.ceil((max - min) / 50)); // Create up to 50 bins

        const bins = {};
        pullCounts.forEach(result => {
            const binStart = Math.floor((result - min) / binSize) * binSize + min;
            bins[binStart] = (bins[binStart] || 0) + 1;
        });

        return Object.entries(bins)
            .map(([bin, count]) => ({ bin: parseInt(bin), count }))
            .sort((a, b) => a.bin - b.bin);
    }

    displayResults(results) {
        // Store results for display mode switching
        this.lastResults = results;

        // Check display mode with null safety
        const displayModeElement = document.querySelector('input[name="displayMode"]:checked');
        const displayMode = displayModeElement ? displayModeElement.value : 'pulls';
        const multiplier = displayMode === 'astrites' ? this.gameConfig.currencyMultiplier : 1;
        const unit = displayMode === 'astrites' ? this.gameConfig.currency.primary : 'Pulls';

        const stats = this.calculateStats(results);

        // Update pull statistics labels and values with null checking
        const pullStatsTitle = document.getElementById('pullStatsTitle');
        if (pullStatsTitle) pullStatsTitle.textContent = `${unit} Statistics`;

        const avgPullsLabel = document.getElementById('avgPullsLabel');
        if (avgPullsLabel) avgPullsLabel.textContent = `Average ${unit}:`;

        const medianPullsLabel = document.getElementById('medianPullsLabel');
        if (medianPullsLabel) medianPullsLabel.textContent = `Median ${unit}:`;

        const minPullsLabel = document.getElementById('minPullsLabel');
        if (minPullsLabel) minPullsLabel.textContent = `Min ${unit}:`;

        const maxPullsLabel = document.getElementById('maxPullsLabel');
        if (maxPullsLabel) maxPullsLabel.textContent = `Max ${unit}:`;

        const p90PullsLabel = document.getElementById('p90PullsLabel');
        if (p90PullsLabel) p90PullsLabel.textContent = `90th Percentile ${unit}:`;

        const avgPulls = document.getElementById('avgPulls');
        if (avgPulls) avgPulls.textContent = (stats.pulls.average * multiplier).toFixed(multiplier === 160 ? 0 : 1);

        const medianPulls = document.getElementById('medianPulls');
        if (medianPulls) medianPulls.textContent = stats.pulls.median * multiplier;

        const minPulls = document.getElementById('minPulls');
        if (minPulls) minPulls.textContent = stats.pulls.min * multiplier;

        const maxPulls = document.getElementById('maxPulls');
        if (maxPulls) maxPulls.textContent = stats.pulls.max * multiplier;

        const p90Pulls = document.getElementById('p90Pulls');
        if (p90Pulls) p90Pulls.textContent = stats.pulls.p90 * multiplier;

        // Update A-rank statistics with null checking
        const avgARanks = document.getElementById('avgARanks');
        if (avgARanks) avgARanks.textContent = stats.aRanks.average.toFixed(1);

        const medianARanks = document.getElementById('medianARanks');
        if (medianARanks) medianARanks.textContent = stats.aRanks.median;

        const minARanks = document.getElementById('minARanks');
        if (minARanks) minARanks.textContent = stats.aRanks.min;

        const maxARanks = document.getElementById('maxARanks');
        if (maxARanks) maxARanks.textContent = stats.aRanks.max;

        const p90ARanks = document.getElementById('p90ARanks');
        if (p90ARanks) p90ARanks.textContent = stats.aRanks.p90;

        // Update coral statistics with dynamic labels
        const params = this.getParameters();
        let coralType, coralTitle, coralStats;

        const currencyName = this.gameConfig.currency.secondary;
        switch (params.coralMode) {
            case 'reinvest':
                coralType = "Free Pulls";
                coralTitle = "Free Pulls Statistics";
                coralStats = stats.freePulls;
                break;
            case 'sequences':
                coralType = `Leftover ${currencyName}`;
                coralTitle = `Leftover ${currencyName} Statistics`;
                coralStats = stats.totalCorals;
                break;
            case 'none':
            default:
                coralType = currencyName;
                coralTitle = `${currencyName} Statistics`;
                coralStats = stats.totalCorals;
                break;
        }

        // Update coral statistics with null checking
        const coralStatsTitle = document.getElementById('coralStatsTitle');
        if (coralStatsTitle) coralStatsTitle.textContent = coralTitle;

        const avgCoralsLabel = document.getElementById('avgCoralsLabel');
        if (avgCoralsLabel) avgCoralsLabel.textContent = `Average ${coralType}:`;

        const medianCoralsLabel = document.getElementById('medianCoralsLabel');
        if (medianCoralsLabel) medianCoralsLabel.textContent = `Median ${coralType}:`;

        const minCoralsLabel = document.getElementById('minCoralsLabel');
        if (minCoralsLabel) minCoralsLabel.textContent = `Min ${coralType}:`;

        const maxCoralsLabel = document.getElementById('maxCoralsLabel');
        if (maxCoralsLabel) maxCoralsLabel.textContent = `Max ${coralType}:`;

        const p90CoralsLabel = document.getElementById('p90CoralsLabel');
        if (p90CoralsLabel) p90CoralsLabel.textContent = `90th Percentile ${coralType}:`;

        const avgCorals = document.getElementById('avgCorals');
        if (avgCorals) avgCorals.textContent = coralStats.average.toFixed(1);

        const medianCorals = document.getElementById('medianCorals');
        if (medianCorals) medianCorals.textContent = coralStats.median;

        const minCorals = document.getElementById('minCorals');
        if (minCorals) minCorals.textContent = coralStats.min;

        const maxCorals = document.getElementById('maxCorals');
        if (maxCorals) maxCorals.textContent = coralStats.max;

        const p90Corals = document.getElementById('p90Corals');
        if (p90Corals) p90Corals.textContent = coralStats.p90;

        // Create chart
        const pullCounts = results.map(r => r.totalPulls);
        this.createChart(pullCounts);
    }

    createChart(results) {
        const ctx = document.getElementById('distributionChart').getContext('2d');

        if (this.chart) {
            this.chart.destroy();
        }

        const displayModeElement = document.querySelector('input[name="displayMode"]:checked');
        const isAstrites = displayModeElement ? displayModeElement.value === 'astrites' : false;
        const multiplier = isAstrites ? this.gameConfig.currencyMultiplier : 1;
        const unit = isAstrites ? this.gameConfig.currency.primary : 'Pulls';

        const convertedResults = results.map(r => r * multiplier);
        const histogram = this.createHistogram(convertedResults);
        const percentiles = this.calculatePercentiles(convertedResults);

        // Prepare chart options
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: this.annotationAvailable ?
                        `Distribution of ${unit}` :
                        `Distribution of ${unit} | 50%=${isAstrites ? Math.round(percentiles[50]) : percentiles[50]} | 75%=${isAstrites ? Math.round(percentiles[75]) : percentiles[75]} | 90%=${isAstrites ? Math.round(percentiles[90]) : percentiles[90]}`
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: `Number of ${unit}`
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Frequency'
                    },
                    beginAtZero: true
                }
            }
        };

        // Store percentiles for custom plugin
        this.currentPercentiles = percentiles;
        this.currentHistogram = histogram;
        this.currentDisplayMode = isAstrites ? 'astrites' : 'pulls';

        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: histogram.map(h => `${h.bin}-${h.bin + Math.ceil((Math.max(...convertedResults) - Math.min(...convertedResults)) / 50)}`),
                datasets: [{
                    label: 'Frequency',
                    data: histogram.map(h => h.count),
                    backgroundColor: 'rgba(79, 172, 254, 0.6)',
                    borderColor: 'rgba(79, 172, 254, 1)',
                    borderWidth: 1
                }]
            },
            options: chartOptions
        });
    }

    calculatePercentiles(results) {
        const sorted = [...results].sort((a, b) => a - b);
        const percentiles = [1, 5, 10, 25, 50, 75, 90, 95, 99];

        return percentiles.reduce((acc, p) => {
            const index = Math.floor((p / 100) * sorted.length);
            acc[p] = sorted[Math.min(index, sorted.length - 1)];
            return acc;
        }, {});
    }

    getXPositionForValue(chart, value) {
        if (!this.currentHistogram) return null;

        // Find the closest bin
        let closestBinIndex = 0;
        let closestDiff = Math.abs(this.currentHistogram[0].bin - value);

        for (let i = 1; i < this.currentHistogram.length; i++) {
            const diff = Math.abs(this.currentHistogram[i].bin - value);
            if (diff < closestDiff) {
                closestDiff = diff;
                closestBinIndex = i;
            }
        }

        // Get the x position for this data index
        const meta = chart.getDatasetMeta(0);
        if (meta.data[closestBinIndex]) {
            return meta.data[closestBinIndex].x;
        }

        return null;
    }

    initializeGameTabs() {
        // Set up tab switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchGame(e.target.dataset.game);
            });
        });

        // Check URL hash for direct game link
        const hash = window.location.hash.substring(1);
        if (hash && GAME_CONFIGS[hash]) {
            this.switchGame(hash);
        }
    }

    switchGame(gameKey) {
        // Update active game
        this.currentGame = gameKey;
        this.gameConfig = GAME_CONFIGS[gameKey];

        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-game="${gameKey}"]`).classList.add('active');

        // Update URL hash
        window.location.hash = gameKey;

        // Update UI elements
        this.updateUI();
    }

    updateUI() {
        // Update page title
        document.getElementById('main-title').textContent = `${this.gameConfig.name} RNG Simulator`;

        // Update methodology content
        this.updateMethodology();

        // Update display mode labels
        this.updateDisplayModeLabels();

        // Update coral mode section
        this.updateCoralModeSection();

        // Update guarantee selectors
        this.updateGuaranteeSelectors();

        // Update pity max values
        this.updatePityMaxValues();

        // Ensure coral mode has a valid selection
        this.ensureCoralModeSelection();
    }

    updateMethodology() {
        const methodologyContent = document.querySelector('.methodology-content ul');

        const sequenceItem = this.gameConfig.methodology.sequenceText ?
            `<li>${this.gameConfig.methodology.sequenceText}</li>` : '';

        methodologyContent.innerHTML = `
            <li>When pulling for both weapons and characters, weapons are pulled first.</li>
            <li>${this.gameConfig.methodology.pullText}</li>
            ${sequenceItem}
            <li>Soft pity is calculated at ${this.gameConfig.methodology.softPityText}</li>
        `;
    }

    updateDisplayModeLabels() {
        const pullsLabel = document.querySelector('label[for="pullsMode"]');
        const astritesLabel = document.querySelector('label[for="astritesMode"]');

        if (pullsLabel) {
            pullsLabel.textContent = `Display as Pulls`;
        }
        if (astritesLabel) {
            astritesLabel.textContent = `Display as ${this.gameConfig.currency.primary} (${this.gameConfig.currencyMultiplier} per pull)`;
        }
    }

    updateCoralModeSection() {
        const secondaryCurrency = this.gameConfig.currency.secondary;
        const secondaryCurrencyLower = secondaryCurrency.toLowerCase();

        // Update all currency labels
        const currencyElements = document.querySelectorAll('[data-currency="coral"]');
        currencyElements.forEach(element => {
            element.textContent = secondaryCurrency.slice(0, -1); // Remove 's' from plural
        });

        // Update currency names (like "Starting Corals:")
        const startingLabel = document.querySelector('label[for="startingCorals"]');
        if (startingLabel) {
            startingLabel.innerHTML = `Starting <span data-currency="coral">${secondaryCurrency}</span>:`;
        }

        // Update game-specific tooltips and tier labels
        const aRankTooltip = document.querySelector('[data-game-tooltip="arank"]');
        if (aRankTooltip) {
            aRankTooltip.textContent = 'A-rank Characters:';
        }

        const sRankTooltip = document.querySelector('[data-game-tooltip="srank"]');
        if (sRankTooltip) {
            sRankTooltip.textContent = 'Standard S-rank Characters:';
        }

        // Update tier labels based on game (S0/S6 for WuWa, M0/M6 for others)
        const tierSuffix = this.currentGame === 'wuwa' ? 'S' : 'M';

        const aRankM0Label = document.querySelector('label[for="aRankM0"]');
        if (aRankM0Label) aRankM0Label.textContent = `${tierSuffix}0`;

        const aRankM6Label = document.querySelector('label[for="aRankM6"]');
        if (aRankM6Label) aRankM6Label.textContent = `${tierSuffix}6`;

        const sRankM0Label = document.querySelector('label[for="sRankM0"]');
        if (sRankM0Label) sRankM0Label.textContent = `${tierSuffix}0`;

        const sRankM6Label = document.querySelector('label[for="sRankM6"]');
        if (sRankM6Label) sRankM6Label.textContent = `${tierSuffix}6`;

        // Update labels with exact text strings
        const saveLabel = document.querySelector('label[for="coralModeNone"]');
        if (saveLabel) {
            saveLabel.textContent = `Don't spend ${secondaryCurrencyLower} (save all)`;
        }

        const reinvestLabel = document.querySelector('label[for="coralModeReinvest"]');
        if (reinvestLabel) {
            reinvestLabel.textContent = `Reinvest ${secondaryCurrency} as Free Pulls`;
        }

        const sequencesLabel = document.querySelector('label[for="coralModeSequences"]');
        if (sequencesLabel) {
            sequencesLabel.textContent = `Buy Sequences with ${secondaryCurrency}`;
        }

        // Hide sequence mode if game doesn't support it
        const sequenceMode = document.querySelector('input[value="sequences"]');
        if (sequenceMode) {
            const sequenceContainer = sequenceMode.closest('.config-item');
            if (this.gameConfig.sequenceCost === null) {
                sequenceContainer.style.display = 'none';
                // Switch to reinvest mode if currently on sequences
                if (sequenceMode.checked) {
                    const reinvestOption = document.querySelector('input[value="reinvest"]');
                    if (reinvestOption) reinvestOption.checked = true;
                }
            } else {
                sequenceContainer.style.display = 'block';
            }
        }
    }

    updateGuaranteeSelectors() {
        const singleGuarantee = document.getElementById('sRankGuaranteedItem');
        const characterGuarantee = document.getElementById('characterGuaranteedItem');
        const weaponGuarantee = document.getElementById('weaponGuaranteedItem');

        const weaponHasGuarantee = this.gameConfig.banners.weapon.hasGuarantee;

        if (weaponHasGuarantee) {
            // Show separate selectors for character and weapon (like ZZZ)
            if (singleGuarantee) singleGuarantee.style.display = 'none';
            if (characterGuarantee) characterGuarantee.style.display = 'block';
            if (weaponGuarantee) weaponGuarantee.style.display = 'block';
        } else {
            // Show single selector for character only (like WuWa - weapons are always rate-up)
            if (singleGuarantee) singleGuarantee.style.display = 'block';
            if (characterGuarantee) characterGuarantee.style.display = 'none';
            if (weaponGuarantee) weaponGuarantee.style.display = 'none';
        }
    }

    updatePityMaxValues() {
        const characterPityInput = document.getElementById('characterPity');
        const weaponPityInput = document.getElementById('weaponPity');

        if (characterPityInput) {
            characterPityInput.max = this.gameConfig.banners.character.pity;
        }

        if (weaponPityInput) {
            weaponPityInput.max = this.gameConfig.banners.weapon.pity;
        }
    }

    ensureCoralModeSelection() {
        const selectedMode = document.querySelector('input[name="coralMode"]:checked');

        if (!selectedMode) {
            // No selection found, default to 'none'
            const noneOption = document.querySelector('input[name="coralMode"][value="none"]');
            if (noneOption) {
                noneOption.checked = true;
            }
        }
    }

}


// Initialize the simulator when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GachaSimulator();
});
