class GachaSimulator {
    constructor() {
        this.chart = null;
        this.annotationAvailable = false;
        this.initializeAnnotations();
        this.setupEventListeners();
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
        document.querySelectorAll('input[name="displayMode"]').forEach(radio => {
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
    }

    getParameters() {
        const coralMode = document.querySelector('input[name="coralMode"]:checked').value;

        return {
            simulations: parseInt(document.getElementById('simulations').value),
            currentPity: parseInt(document.getElementById('currentPity').value),
            guaranteed: document.getElementById('guaranteed').value === 'true',
            weaponTarget: parseInt(document.getElementById('weaponTarget').value),
            characterTarget: parseInt(document.getElementById('characterTarget').value),
            startingCorals: parseInt(document.getElementById('startingCorals').value),
            aRankS0: document.getElementById('aRankS0').checked,
            standardSRankS0: document.getElementById('standardSRankS0').checked,
            coralMode: coralMode,
            reinvestCorals: coralMode === 'reinvest', // For backward compatibility
            sequenceMode: coralMode === 'sequences'
        };
    }

    calculateWuWaProbability(pityCount) {
        // Wuthering Waves Character Banner Rates
        let baseRate = 0.008; // 0.8%

        // Pity increases at specific thresholds
        if (pityCount >= 66) {
            // Climbs by 4% each pull from 66 onwards (4% total)
            baseRate += 0.04 * (pityCount - 65);
        }
        if (pityCount >= 71) {
            // Climbs by additional 4% each pull from 71 onwards (8% total)
            baseRate += 0.04 * (pityCount - 70);
        }
        if (pityCount >= 76) {
            // Climbs by additional 1% each pull from 76 onwards (9% total)
            baseRate += 0.01 * (pityCount - 75);
        }

        return Math.min(baseRate, 1.0);
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
                target: params.weaponTarget,
                guaranteed: false, // Weapon banner has no 50/50
                startingCorals: params.startingCorals,
                coralMode: 'none' // Always save corals for weapon banner
            });
        } else {
            weaponResult.totalCorals = params.startingCorals; // No weapon pulls, keep starting corals
        }

        if (params.characterTarget > 0) {
            characterResult = this.simulateBannerRun({
                ...params,
                bannerType: 'character',
                target: params.characterTarget,
                startingCorals: weaponResult.totalCorals // Use corals from weapon banner
            });
        } else if (params.weaponTarget > 0) {
            // Only weapons, apply coral mode to weapon result
            characterResult.totalCorals = this.calculateCoralResult(params, weaponResult.totalCorals, 0, 0);
        } else {
            // Neither weapons nor characters - just return starting corals
            characterResult.totalCorals = params.startingCorals;
        }

        return {
            totalPulls: weaponResult.totalPulls + characterResult.totalPulls,
            totalARanks: weaponResult.totalARanks + characterResult.totalARanks,
            totalCorals: params.characterTarget > 0 ? characterResult.totalCorals : this.calculateCoralResult(params, weaponResult.totalCorals, 0, 0)
        };
    }

    simulateBannerRun(params) {
        let sPityCount = params.currentPity;
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
            if (params.reinvestCorals && totalCorals >= 8) {
                totalCorals -= 8;
                freePullsEarned++;
                isFreePull = true;
            } else {
                actualPulls++;
            }

            sPityCount++;
            aPityCount++;

            const sRankProbability = this.calculateWuWaProbability(sPityCount);

            if (Math.random() < sRankProbability) {
                // Got an S-rank, handle differently based on banner type
                let coralsFromSRank = 0;

                let gotRateUp = false;

                if (params.bannerType === 'weapon') {
                    // Weapon banner: no 50/50, always get the rate-up weapon
                    rateUpObtained++;
                    gotRateUp = true;
                    coralsFromSRank = 15; // Always 15 corals for rate-up weapon
                } else {
                    // Character banner: 50/50 system
                    if (isGuaranteed) {
                        // Guaranteed rate-up
                        rateUpObtained++;
                        gotRateUp = true;
                        isGuaranteed = false; // Reset to 50/50 after guaranteed
                        coralsFromSRank = 15; // Always 15 corals for rate-up
                    } else {
                        // 50/50 chance
                        if (Math.random() < 0.5) {
                            // Won 50/50, got rate-up
                            rateUpObtained++;
                            gotRateUp = true;
                            coralsFromSRank = 15; // Always 15 corals for rate-up
                            // Next remains 50/50
                        } else {
                            // Lost 50/50, got standard S-rank
                            isGuaranteed = true; // Next S-rank is guaranteed rate-up
                            coralsFromSRank = params.standardSRankS0 ? 45 : 70; // Based on config
                        }
                    }
                }

                totalCorals += coralsFromSRank;

                sPityCount = 0; // Reset S-rank pity after getting S-rank
                aPityCount = 0; // Reset A-rank pity after getting S-rank

                // Check for sequence purchase (only for character banner after getting rate-up)
                // This happens after resetting pity, so we're now at 0 pity and 50/50 state
                if (params.sequenceMode && params.bannerType === 'character' && gotRateUp &&
                    !isGuaranteed) { // At 0 pity and 50/50 state after winning
                    while (totalCorals >= 370 && rateUpObtained < params.target) {
                        totalCorals -= 370;
                        rateUpObtained++;
                        sequencesPurchased++;
                    }
                }
            } else {
                // Didn't get S-rank, check for A-rank
                const aRankProbability = 0.06; // 6% base rate
                const guaranteedARank = aPityCount >= 10; // Guaranteed on 10th pull

                if (guaranteedARank || Math.random() < aRankProbability) {
                    // Got an A-rank
                    totalARanks++;
                    let result = this.calculateARankCorals(aIsGuaranteed, params);
                    totalCorals += result.corals;
                    aIsGuaranteed = result.newGuaranteeState;
                    aPityCount = 0; // Reset A-rank pity
                }
                // If neither S-rank nor A-rank, continue (R-rank)
            }
        }

        return {
            totalPulls: actualPulls,
            totalARanks: totalARanks,
            totalCorals: this.calculateCoralResult(params, totalCorals, freePullsEarned, sequencesPurchased)
        };
    }

    calculateCoralResult(params, totalCorals, freePullsEarned, sequencesPurchased) {
        switch (params.coralMode) {
            case 'reinvest':
                return freePullsEarned;
            case 'sequences':
                return totalCorals; // Leftover corals after sequence purchases
            case 'none':
            default:
                return totalCorals; // All corals saved
        }
    }

    calculateARankCorals(aIsGuaranteed, params) {
        if (aIsGuaranteed) {
            // Guaranteed A-rank rate-up
            if (params.bannerType === 'weapon') {
                // Weapon banner: guaranteed A-rank is always a weapon (3 corals)
                return {
                    corals: 3,
                    newGuaranteeState: false // Reset after guaranteed
                };
            } else {
                // Character banner: guaranteed A-rank rate-up character
                return {
                    corals: params.aRankS0 ? 3 : 8,
                    newGuaranteeState: false // Reset after guaranteed
                };
            }
        } else {
            // A-rank 50/50
            if (Math.random() < 0.5) {
                // Won A-rank 50/50
                if (params.bannerType === 'weapon') {
                    // Weapon banner: won 50/50, got rate-up weapon (always 3 corals)
                    return {
                        corals: 3,
                        newGuaranteeState: false // Remains 50/50
                    };
                } else {
                    // Character banner: won 50/50, got rate-up character
                    return {
                        corals: params.aRankS0 ? 3 : 8,
                        newGuaranteeState: false // Remains 50/50
                    };
                }
            } else {
                // Lost A-rank 50/50
                if (params.bannerType === 'weapon') {
                    // Weapon banner: lost 50/50, get random character vs weapon
                    if (Math.random() < 0.5) {
                        // Character banner standard A-rank
                        return {
                            corals: params.aRankS0 ? 3 : 8,
                            newGuaranteeState: true // Next A-rank is guaranteed rate-up
                        };
                    } else {
                        // Weapon banner A-rank (always 3 corals)
                        return {
                            corals: 3,
                            newGuaranteeState: true // Next A-rank is guaranteed rate-up
                        };
                    }
                } else {
                    // Character banner: lost 50/50, get random character vs weapon
                    if (Math.random() < 0.5) {
                        // Character banner standard A-rank
                        return {
                            corals: params.aRankS0 ? 3 : 8,
                            newGuaranteeState: true // Next A-rank is guaranteed rate-up
                        };
                    } else {
                        // Weapon banner A-rank (always 3 corals)
                        return {
                            corals: 3,
                            newGuaranteeState: true // Next A-rank is guaranteed rate-up
                        };
                    }
                }
            }
        }
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

        const sortedPulls = [...pullCounts].sort((a, b) => a - b);
        const sortedARanks = [...aRankCounts].sort((a, b) => a - b);
        const sortedCorals = [...coralCounts].sort((a, b) => a - b);

        return {
            pulls: {
                average: pullCounts.reduce((sum, val) => sum + val, 0) / pullCounts.length,
                median: sortedPulls[Math.floor(sortedPulls.length / 2)],
                min: Math.min(...pullCounts),
                max: Math.max(...pullCounts),
                p90: sortedPulls[Math.floor(sortedPulls.length * 0.9)]
            },
            aRanks: {
                average: aRankCounts.reduce((sum, val) => sum + val, 0) / aRankCounts.length,
                median: sortedARanks[Math.floor(sortedARanks.length / 2)],
                min: Math.min(...aRankCounts),
                max: Math.max(...aRankCounts),
                p90: sortedARanks[Math.floor(sortedARanks.length * 0.9)]
            },
            corals: {
                average: coralCounts.reduce((sum, val) => sum + val, 0) / coralCounts.length,
                median: sortedCorals[Math.floor(sortedCorals.length / 2)],
                min: Math.min(...coralCounts),
                max: Math.max(...coralCounts),
                p90: sortedCorals[Math.floor(sortedCorals.length * 0.9)]
            }
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

        // Check display mode
        const displayMode = document.querySelector('input[name="displayMode"]:checked').value;
        const multiplier = displayMode === 'astrites' ? 160 : 1;
        const unit = displayMode === 'astrites' ? 'Astrites' : 'Pulls';

        const stats = this.calculateStats(results);

        // Update pull statistics labels and values
        document.getElementById('pullStatsTitle').textContent = `${unit} Statistics`;
        document.getElementById('avgPullsLabel').textContent = `Average ${unit}:`;
        document.getElementById('medianPullsLabel').textContent = `Median ${unit}:`;
        document.getElementById('minPullsLabel').textContent = `Min ${unit}:`;
        document.getElementById('maxPullsLabel').textContent = `Max ${unit}:`;
        document.getElementById('p90PullsLabel').textContent = `90th Percentile ${unit}:`;

        document.getElementById('avgPulls').textContent = (stats.pulls.average * multiplier).toFixed(multiplier === 160 ? 0 : 1);
        document.getElementById('medianPulls').textContent = stats.pulls.median * multiplier;
        document.getElementById('minPulls').textContent = stats.pulls.min * multiplier;
        document.getElementById('maxPulls').textContent = stats.pulls.max * multiplier;
        document.getElementById('p90Pulls').textContent = stats.pulls.p90 * multiplier;

        // Update A-rank statistics
        document.getElementById('avgARanks').textContent = stats.aRanks.average.toFixed(1);
        document.getElementById('medianARanks').textContent = stats.aRanks.median;
        document.getElementById('minARanks').textContent = stats.aRanks.min;
        document.getElementById('maxARanks').textContent = stats.aRanks.max;
        document.getElementById('p90ARanks').textContent = stats.aRanks.p90;

        // Update coral statistics with dynamic labels
        const params = this.getParameters();
        let coralType, coralTitle;

        switch (params.coralMode) {
            case 'reinvest':
                coralType = "Free Pulls";
                coralTitle = "Free Pulls Statistics";
                break;
            case 'sequences':
                coralType = "Leftover Corals";
                coralTitle = "Leftover Coral Statistics";
                break;
            case 'none':
            default:
                coralType = "Corals";
                coralTitle = "Coral Statistics";
                break;
        }

        document.getElementById('coralStatsTitle').textContent = coralTitle;
        document.getElementById('avgCoralsLabel').textContent = `Average ${coralType}:`;
        document.getElementById('medianCoralsLabel').textContent = `Median ${coralType}:`;
        document.getElementById('minCoralsLabel').textContent = `Min ${coralType}:`;
        document.getElementById('maxCoralsLabel').textContent = `Max ${coralType}:`;
        document.getElementById('p90CoralsLabel').textContent = `90th Percentile ${coralType}:`;

        document.getElementById('avgCorals').textContent = stats.corals.average.toFixed(1);
        document.getElementById('medianCorals').textContent = stats.corals.median;
        document.getElementById('minCorals').textContent = stats.corals.min;
        document.getElementById('maxCorals').textContent = stats.corals.max;
        document.getElementById('p90Corals').textContent = stats.corals.p90;

        // Create chart
        const pullCounts = results.map(r => r.totalPulls);
        this.createChart(pullCounts);
    }

    createChart(results) {
        const ctx = document.getElementById('distributionChart').getContext('2d');

        if (this.chart) {
            this.chart.destroy();
        }

        const isAstrites = document.querySelector('input[name="displayMode"]:checked').value === 'astrites';
        const multiplier = isAstrites ? 160 : 1;
        const unit = isAstrites ? 'Astrites' : 'Pulls';

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

}


// Initialize the simulator when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GachaSimulator();
});
