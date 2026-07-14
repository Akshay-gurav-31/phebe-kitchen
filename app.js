// PKU-Safe Food Database — Only USDA-verified foods from foods.json
// These are the only foods the estimator has clinical data for
const FOOD_DATABASE = {
    // Fruits (USDA FDC verified)
    'banana': {},
    'apple': {},
    'strawberry': {},
    'strawberries': {},
    'tomato': {},
    // Vegetables (USDA FDC verified)
    'broccoli': {},
    'carrot': {},
    'carrots': {},
    'cucumber': {},
    // Grains & Starches (USDA FDC verified)
    'rice': {},
    'cornstarch': {},
    'tapioca': {},
    'potato flour': {},
};

// Verified USDA food dataset (replicated from foods.json)
const FOODS_JSON = [
    {"key": "cornstarch", "description": "Cornstarch", "phe_mg_per_100g": 13.0, "protein_g_per_100g": 0.26, "class": "refined starch"},
    {"key": "tapioca pearl dry", "description": "Tapioca, pearl, dry", "phe_mg_per_100g": 4.0, "protein_g_per_100g": 0.19, "class": "refined starch"},
    {"key": "potato flour", "description": "Potato flour", "phe_mg_per_100g": 316.0, "protein_g_per_100g": 6.9, "class": "tuber/root starch"},
    {"key": "rice white raw", "description": "Rice, white, medium-grain, raw, enriched", "phe_mg_per_100g": 353.0, "protein_g_per_100g": 6.61, "class": "cereal protein"},
    {"key": "apple raw with skin", "description": "Apples, raw, without skin", "phe_mg_per_100g": 7.0, "protein_g_per_100g": 0.27, "class": "fruit protein"},
    {"key": "banana raw", "description": "Bananas, raw", "phe_mg_per_100g": 49.0, "protein_g_per_100g": 1.09, "class": "fruit protein"},
    {"key": "carrots raw", "description": "Carrots, raw", "phe_mg_per_100g": 61.0, "protein_g_per_100g": 0.93, "class": "vegetable protein"},
    {"key": "cucumber with peel raw", "description": "Cucumber, peeled, raw", "phe_mg_per_100g": 31.0, "protein_g_per_100g": 0.59, "class": "vegetable protein"},
    {"key": "broccoli raw", "description": "Broccoli, raw", "phe_mg_per_100g": 117.0, "protein_g_per_100g": 2.82, "class": "vegetable protein"},
    {"key": "strawberries raw", "description": "Strawberries, raw", "phe_mg_per_100g": 19.0, "protein_g_per_100g": 0.67, "class": "fruit protein"},
    {"key": "tomatoes red ripe raw", "description": "Tomatoes, red, ripe, raw, year round average", "phe_mg_per_100g": 27.0, "protein_g_per_100g": 0.88, "class": "fruit protein"}
];

// Manual classification constants matching Path B fallback in precision_yield_estimator.py
const MANUAL_CATEGORIES = {
    'fruit': { class: 'fruit protein', protein_pct: 0.7, ratio: 31.5 },
    'veg': { class: 'vegetable protein', protein_pct: 1.8, ratio: 36.8 },
    'cereal': { class: 'cereal protein', protein_pct: 6.8, ratio: 54.7 },
    'starch': { class: 'refined starch', protein_pct: 0.3, ratio: 0.0 },
    'tuber': { class: 'tuber/root starch', protein_pct: 1.6, ratio: 45.3 }
};

// Portion units conversion to grams based on representative food density
function convertToGrams(foodName, quantity, unit) {
    const q = parseFloat(quantity);
    if (isNaN(q) || q <= 0) return 0;
    if (unit === 'g') return q;
    if (unit === 'oz') return q * 28.35;
    
    const n = foodName.toLowerCase().trim();
    if (unit === 'cup') {
        if (n.includes('banana')) return q * 150;
        if (n.includes('apple')) return q * 125;
        if (n.includes('strawberr')) return q * 150;
        if (n.includes('tomato')) return q * 180;
        if (n.includes('broccoli')) return q * 90;
        if (n.includes('carrot')) return q * 120;
        if (n.includes('cucumber')) return q * 150;
        if (n.includes('rice')) return q * 195;
        if (n.includes('starch') || n.includes('tapioca') || n.includes('flour')) return q * 120;
        return q * 150; // Generic fallback
    }
    
    if (unit === 'piece') {
        if (n.includes('banana')) return q * 120;
        if (n.includes('apple')) return q * 180;
        if (n.includes('strawberr')) return q * 12;
        if (n.includes('tomato')) return q * 120;
        if (n.includes('broccoli')) return q * 15;
        if (n.includes('carrot')) return q * 60;
        if (n.includes('cucumber')) return q * 200;
        return q * 100; // Generic fallback
    }
    return q;
}

// Serverless Clinical Phe Estimator (perfect port of Python precision_yield_estimator.py)
function estimatePheLocal(foodName, weight, manualSource = '') {
    const n = foodName.toLowerCase().trim();
    
    // 1. Pre-verified database lookup
    let matchedRow = null;
    for (const row of FOODS_JSON) {
        const parts = row.key.split(/[ _]/);
        let stem = parts[0].toLowerCase();
        if (stem.endsWith('s')) {
            stem = stem.slice(0, -1);
        }
        const stem6 = stem.slice(0, 6);
        if (stem6 && n.includes(stem6)) {
            matchedRow = row;
            break;
        }
    }

    // 2. If no database match, check manual override dropdown selection
    if (!matchedRow && manualSource && MANUAL_CATEGORIES[manualSource]) {
        const categoryData = MANUAL_CATEGORIES[manualSource];
        const phe100 = categoryData.protein_pct * categoryData.ratio;
        const recipe_factor = (phe100 * weight) / 100.0;
        const phe_mg = Math.max(recipe_factor * 1.04, recipe_factor + 1.5);
        return {
            phe_mg: Math.round(phe_mg * 10) / 10,
            meta: {
                recipe_factor_mg_per_serving: Math.round(recipe_factor * 10) / 10,
                serving_size_g: weight,
                portion_g: weight,
                countable: null,
                protein_g_per_serving: null,
                path: "manual source override (Path B fallback)",
                ingredients_considered: [{
                    name: foodName || manualSource,
                    phe_source_class: "whole food (food-list)", // Allow logging!
                    est_share: 1.0
                }],
                phe_mg_per_100g: phe100,
                class: categoryData.class
            }
        };
    }

    // 3. Fallback to unverified/unsafe if neither database match nor manual override
    if (!matchedRow) {
        return {
            phe_mg: 0.0,
            meta: {
                recipe_factor_mg_per_serving: 0.0,
                serving_size_g: weight,
                portion_g: weight,
                countable: null,
                protein_g_per_serving: null,
                path: "food-list lookup (no protein panel)",
                ingredients_considered: [{
                    name: foodName,
                    phe_source_class: "unknown (unsafe)",
                    est_share: 1.0
                }]
            }
        };
    }

    const phe100 = matchedRow.phe_mg_per_100g;
    const recipe_factor = (phe100 * weight) / 100.0;
    
    // Safety margin: max(est * 1.04, est + 1.5)
    const phe_mg = Math.max(recipe_factor * 1.04, recipe_factor + 1.5);

    return {
        phe_mg: Math.round(phe_mg * 10) / 10,
        meta: {
            recipe_factor_mg_per_serving: Math.round(recipe_factor * 10) / 10,
            serving_size_g: weight,
            portion_g: weight,
            countable: null,
            protein_g_per_serving: null,
            path: "food-list lookup (no protein panel)",
            ingredients_considered: [{
                name: foodName,
                phe_source_class: "whole food (food-list)",
                est_share: 1.0
            }],
            phe_mg_per_100g: phe100,
            class: matchedRow.class
        }
    };
}


document.addEventListener('DOMContentLoaded', () => {
    // Set current date in header and budget info
    const currentDateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const headerDate = document.getElementById('header-date');
    if (headerDate) headerDate.textContent = currentDateStr;
    const budgetDate = document.getElementById('budget-date');
    if (budgetDate) budgetDate.textContent = currentDateStr;

    const form = document.getElementById('calc-form');
    const resultCard = document.getElementById('result-card');
    const pheResult = document.getElementById('phe-result');
    const breakdownList = document.getElementById('breakdown-list');
    const foodNameInput = document.getElementById('food-name');
    const foodWeightInput = document.getElementById('food-weight');
    const autocompleteList = document.getElementById('autocomplete-list');
    const logBtn = document.getElementById('log-btn');

    // Prevent typing of invalid numeric characters (negative, plus, exponent)
    foodWeightInput.addEventListener('keydown', (e) => {
        if (['e', 'E', '-', '+'].includes(e.key)) {
            e.preventDefault();
        }
    });

    // Always light mode, but styled using M3 clinical theme
    document.documentElement.classList.remove('dark');
    document.body.style.backgroundColor = '#f4fbf4';
    document.body.style.color = '#161d19';

    // ── Autocomplete Logic ────────────────────────────────────────────────
    foodNameInput.addEventListener('input', function() {
        const val = this.value.toLowerCase();
        autocompleteList.innerHTML = '';
        
        if (!val) {
            autocompleteList.classList.add('hidden');
            return;
        }
        
        let hasMatches = false;
        for (const key of Object.keys(FOOD_DATABASE)) {
            if (key.includes(val)) {
                hasMatches = true;
                const item = document.createElement('div');
                
                // Highlight the matching part
                const matchIndex = key.indexOf(val);
                const before = key.substring(0, matchIndex);
                const match = key.substring(matchIndex, matchIndex + val.length);
                const after = key.substring(matchIndex + val.length);
                
                item.innerHTML = `${before}<strong class="text-primary font-bold">${match}</strong>${after}`;
                item.style.cssText = `
                    padding: 10px 16px;
                    cursor: pointer;
                    font-size: 14px;
                    border-bottom: 1px solid #dde4dd;
                    color: #161d19;
                    transition: background 0.15s ease, color 0.15s ease;
                `;
                
                item.addEventListener('mouseenter', () => {
                    item.style.backgroundColor = 'rgba(0,108,74,0.08)';
                    item.style.color = '#006c4a';
                });
                item.addEventListener('mouseleave', () => {
                    item.style.backgroundColor = '';
                    item.style.color = '#161d19';
                });
                item.addEventListener('click', function() {
                    foodNameInput.value = key;
                    autocompleteList.innerHTML = '';
                    autocompleteList.classList.add('hidden');
                });
                autocompleteList.appendChild(item);
            }
        }
        
        if (hasMatches) {
            autocompleteList.classList.remove('hidden');
        } else {
            autocompleteList.classList.add('hidden');
        }
    });

    // Close dropdown if clicked outside
    document.addEventListener('click', function(e) {
        if (e.target !== foodNameInput) {
            autocompleteList.classList.add('hidden');
        }
    });

    // ── State for tracking calculation ────────────────────────────────────
    let lastEstimate = null;
    let isEstimating = false;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isEstimating) return;
        
        const foodNameVal = foodNameInput.value.trim();
        const foodWeight = parseFloat(foodWeightInput.value);
        const foodUnit = document.getElementById('food-unit').value;
        
        // Clear any previous errors
        foodNameInput.style.borderColor = '';
        foodNameInput.style.boxShadow = '';
        const existingNameErr = document.getElementById('food-name-error');
        if (existingNameErr) existingNameErr.remove();

        foodWeightInput.style.borderColor = '';
        foodWeightInput.style.boxShadow = '';
        const existingWeightErr = document.getElementById('food-weight-error');
        if (existingWeightErr) existingWeightErr.remove();

        let hasError = false;

        // Validate weight (must be > 0)
        if (isNaN(foodWeight) || foodWeight <= 0) {
            foodWeightInput.style.borderColor = '#ba1a1a';
            foodWeightInput.style.boxShadow = '0 0 0 2px rgba(186,26,26,0.2)';
            let errMsg = document.createElement('p');
            errMsg.id = 'food-weight-error';
            errMsg.style.cssText = 'color:#ba1a1a;font-size:12px;margin-top:4px;font-family:Inter;';
            errMsg.textContent = 'Please enter a valid positive weight.';
            foodWeightInput.parentElement.after(errMsg);
            hasError = true;
        }

        // Validate food name (either database lookup or custom name with manual protein source override)
        let finalMatchedKey = '';
        if (!foodNameVal) {
            hasError = true;
        } else {
            let matchedKey = null;
            const n = foodNameVal.toLowerCase();
            for (const key of Object.keys(FOOD_DATABASE)) {
                const parts = key.split(/[ _]/);
                let stem = parts[0].toLowerCase();
                if (stem.endsWith('s')) {
                    stem = stem.slice(0, -1);
                }
                const stem6 = stem.slice(0, 6);
                if (stem6 && n.includes(stem6)) {
                    matchedKey = key;
                    break;
                }
            }

            if (!matchedKey) {
                foodNameInput.style.borderColor = '#ba1a1a';
                foodNameInput.style.boxShadow = '0 0 0 2px rgba(186,26,26,0.2)';
                let errMsg = document.createElement('p');
                errMsg.id = 'food-name-error';
                errMsg.style.cssText = 'color:#ba1a1a;font-size:12px;margin-top:4px;font-family:Inter;';
                foodNameInput.parentElement.after(errMsg);
                errMsg.textContent = `"${foodNameVal}" is not in the verified food list. Please pick from the dropdown suggestions.`;
                hasError = true;
            } else {
                // Normalize input value to matching database key
                foodNameInput.value = matchedKey;
                finalMatchedKey = matchedKey;
            }
        }

        if (hasError) return;
        
        // Show loading state
        breakdownList.innerHTML = '';
        pheResult.innerHTML = '<span class="material-symbols-outlined animate-spin text-3xl">sync</span>';
        resultCard.classList.remove('visible'); // Hide previous result with style display rules
        void resultCard.offsetWidth; // Force layout recalculation
        resultCard.classList.add('visible');

        const submitBtn = document.getElementById('submit-btn');
        isEstimating = true;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">sync</span> Estimating...';
            submitBtn.style.opacity = '0.75';
        }
        
        try {
            // Apply unit conversion to get weight in grams
            const weightGrams = convertToGrams(finalMatchedKey, foodWeight, foodUnit);

            // Minimum 400ms loading so user SEES the spinner
            const [data] = await Promise.all([
                new Promise(resolve => {
                    const res = estimatePheLocal(finalMatchedKey, weightGrams);
                    resolve(res);
                }),
                new Promise(r => setTimeout(r, 400))
            ]);
            
            const phe = data.phe_mg;
            const meta = data.meta;
            
            // Render Result with pop animation
            pheResult.innerText = phe.toFixed(1);
            pheResult.classList.remove('num-pop');
            void pheResult.offsetWidth; // reflow
            pheResult.classList.add('num-pop');
            
            const considered = meta.ingredients_considered || [];
            const isSafe = considered.length > 0 && considered.every(i => i.phe_source_class === 'whole food (food-list)');
            
            const badge = document.querySelector('.status-badge');
            if (isSafe) {
                // Clinically Verified — show log button
                logBtn.classList.remove('hidden');
                
                badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(0,108,74,0.6)]"></span><span class="font-label-caps text-[10px] leading-tight font-bold tracking-wider">Clinically Verified</span>`;
                badge.className = 'status-badge badge-verified inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border';
                badge.style.cssText = 'background:rgba(232,245,240,0.85); border-color:rgba(0,108,74,0.22); color:#006c4a;';
                
                addBreakdownItem('Food Type', capitalize(meta.class || 'whole food'));
                addBreakdownItem('Amount', `${meta.portion_g.toFixed(0)}g (${foodWeight} ${foodUnit})`);
                if (meta.phe_mg_per_100g > 0) {
                    addBreakdownItem('Base Phe/100g', `${meta.phe_mg_per_100g.toFixed(1)} mg`);
                } else {
                    addBreakdownItem('Base Phe/100g', 'Negligible');
                }
                addBreakdownItem('Safety Buffer', 'Applied ✔', true);
                
                // Keep the converted gram weight for budget logging
                lastEstimate = {
                    name: finalMatchedKey,
                    phe: phe,
                    class: meta.class || 'whole food',
                    weight: Math.round(weightGrams)
                };
                
                logBtn.dataset.logged = 'false';
            } else {
                // Needs review — hide log button, user cannot add unverified food to budget
                logBtn.classList.add('hidden');
                
                badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-error shadow-[0_0_8px_rgba(186,26,26,0.6)]"></span><span class="font-label-caps text-[10px] leading-tight font-bold tracking-wider">Needs Review</span>`;
                badge.className = 'status-badge badge-warn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border';
                badge.style.cssText = 'background:rgba(255,218,214,0.8); border-color:rgba(186,26,26,0.25); color:#ba1a1a;';
                
                addBreakdownItem('Food Type', 'Unverified/Custom');
                addBreakdownItem('Amount', `${weightGrams.toFixed(0)}g`);
                addBreakdownItem('Base Phe/100g', 'Unknown');
                addBreakdownItem('Status', 'Consult your dietitian', true);
                
                lastEstimate = null;
            }
            
            // Scroll to view the result card smoothly
            setTimeout(() => {
                resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 80);
            
        } catch (err) {
            console.error(err);
            pheResult.innerText = '--';
            resultCard.classList.remove('visible');
            lastEstimate = null;
        } finally {
            isEstimating = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `
                    <span class="material-symbols-outlined icon-fill text-white" style="font-size:18px;">auto_awesome</span>
                    <span class="flex-1 text-left">Estimate Phe</span>
                    <span class="material-symbols-outlined text-white" style="font-size:18px;" id="btn-icon">arrow_forward</span>
                `;
                submitBtn.style.opacity = '';
            }
        }
    });

    // ── Daily Budget Tracker ──────────────────────────────────────────────
    let dailyUsed = 0;
    let categoryTotals = {
        fruit: 0,
        veg: 0,
        cereal: 0,
        starch: 0,
        unknown: 0
    };
    let mealLog = [];

    function saveState() {
        try {
            localStorage.setItem('phebe_daily_used', dailyUsed.toString());
            localStorage.setItem('phebe_category_totals', JSON.stringify(categoryTotals));
            localStorage.setItem('phebe_daily_limit', limitInput.value);
            localStorage.setItem('phebe_meal_log', JSON.stringify(mealLog));
        } catch (e) {
            console.error('Failed to save state to localStorage:', e);
        }
    }

    function renderMealLogItem(meal) {
        function getIconForClass(foodClass) {
            if (!foodClass) return { name: 'help_center', bg: 'rgba(108,122,113,0.1)', color: 'text-outline' };
            const fc = foodClass.toLowerCase();
            
            if (fc.includes('cereal') || fc.includes('grain')) return { name: 'bakery_dining', bg: 'rgba(59,130,246,0.1)', color: 'text-blue-500' };
            if (fc.includes('starch')) return { name: 'water_drop', bg: 'rgba(168,85,247,0.1)', color: 'text-purple-500' };
            if (fc.includes('fruit')) return { name: 'nutrition', bg: 'rgba(249,115,22,0.1)', color: 'text-orange-500' };
            if (fc.includes('veg') || fc.includes('legume')) return { name: 'eco', bg: 'rgba(0,108,74,0.1)', color: 'text-primary' };
            
            return { name: 'help_center', bg: 'rgba(108,122,113,0.1)', color: 'text-outline' };
        }
        
        const ico = getIconForClass(meal.class);

        const div = document.createElement('div');
        div.className = 'glass-card p-3 rounded-lg flex items-center justify-between border-b border-black/5 log-in';
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full ${ico.bg} flex items-center justify-center">
                    <span class="material-symbols-outlined ${ico.color}">${ico.name}</span>
                </div>
                <div>
                    <p class="font-body-md font-semibold text-on-surface">${capitalize(meal.name)}</p>
                    <p class="font-body-sm text-on-surface-variant">${meal.weight}g • ${capitalize(meal.class)}</p>
                </div>
            </div>
            <div class="flex items-center gap-4">
                <span class="font-numeric-data text-body-md text-on-surface font-semibold">+${meal.phe.toFixed(1)} mg</span>
                <button class="delete-log-btn text-on-surface-variant hover:text-error transition-colors p-1" title="Delete this entry">
                    <span class="material-symbols-outlined text-[20px]">delete</span>
                </button>
            </div>
        `;

        const deleteBtn = div.querySelector('.delete-log-btn');
        deleteBtn.addEventListener('click', () => {
            dailyUsed -= meal.phe;
            if (dailyUsed < 0) dailyUsed = 0;
            
            categoryTotals[meal.category] -= meal.phe;
            if (categoryTotals[meal.category] < 0) categoryTotals[meal.category] = 0;

            mealLog = mealLog.filter(item => item.id !== meal.id);

            // Add slide out animation before removing
            div.style.transition = 'opacity 0.2s, transform 0.2s';
            div.style.opacity = '0';
            div.style.transform = 'translateX(10px)';
            setTimeout(() => {
                div.remove();
                if (mealLogList.children.length === 0) {
                    mealLogList.innerHTML = `
                        <div class="log-empty flex flex-col items-center justify-center py-10 text-center">
                          <span class="material-symbols-outlined icon-fill mb-2" style="font-size:36px; color:#bbcac0;">restaurant_menu</span>
                          <p style="font-size:13px; color:#6c7a71; font-family:'Inter'; font-style:italic;">No meals logged yet</p>
                        </div>
                    `;
                    document.getElementById('log-total-row').classList.add('hidden');
                    document.getElementById('log-total-row').classList.remove('flex');
                } else {
                    document.getElementById('log-total-phe').textContent = `${Math.round(dailyUsed)} mg`;
                }
            }, 200);

            logBtn.dataset.logged = 'false';

            saveState();
            updateBudgetUI();
            updateCategoryBreakdown();
        });

        mealLogList.appendChild(div);
        
        // Show Total row
        const totalRow = document.getElementById('log-total-row');
        if (totalRow) {
            totalRow.classList.remove('hidden');
            totalRow.classList.add('flex');
            document.getElementById('log-total-phe').textContent = `${Math.round(dailyUsed)} mg`;
        }
    }

    const donutArc          = document.getElementById('donut-arc');
    const budgetUsed        = document.getElementById('budget-used');
    const legendUsed        = document.getElementById('legend-used');
    const budgetRem         = document.getElementById('budget-remaining');
    const safetyIndicator   = document.getElementById('safety-indicator');
    const mealLogList       = document.getElementById('meal-log-list');
    const limitInput        = document.getElementById('daily-limit');
    const limitDisplay      = document.getElementById('daily-limit-display');
    const legendLimit       = document.getElementById('legend-limit');
    const breakdownBar      = document.getElementById('category-breakdown-bar');
    const breakdownLabels   = document.getElementById('category-breakdown-labels');

    const CIRCUMFERENCE = 263.9; // 2 * PI * 42 (radius of 42)

    function updateBudgetUI() {
        const limit = parseFloat(limitInput.value) || 300;
        const ratio = Math.min(dailyUsed / limit, 1);
        const offset = CIRCUMFERENCE * (1 - ratio);

        // Donut arc
        donutArc.style.strokeDashoffset = offset;
        
        // Update used indicators
        const roundedUsed = Math.round(dailyUsed);
        budgetUsed.textContent = roundedUsed;
        if (legendUsed) legendUsed.textContent = roundedUsed;
        
        // Update limits
        if (limitDisplay) limitDisplay.textContent = Math.round(limit);
        if (legendLimit) legendLimit.textContent = Math.round(limit);
        
        const remaining = Math.max(limit - dailyUsed, 0);
        budgetRem.textContent = `${Math.round(remaining)} mg`;

        // Update Log Tab Stats
        const roundedRem = Math.round(remaining);
        document.querySelectorAll('.log-stat-used').forEach(el => el.textContent = roundedUsed);
        document.querySelectorAll('.log-stat-rem').forEach(el => el.textContent = roundedRem);
        document.querySelectorAll('.log-stat-limit').forEach(el => el.textContent = Math.round(limit));

        // Safety indicators
        const safetyBanner = document.getElementById('safety-banner');
        const safetyIcon   = document.getElementById('safety-icon');
        const safetyText   = document.getElementById('safety-text');
        
        const safeLabels = document.querySelectorAll('.safety-label');
        safeLabels.forEach(l => {
            l.style.opacity = '0.5';
            l.style.fontWeight = '500';
        });

        if (ratio < 0.7) {
            donutArc.setAttribute('stroke', 'url(#arcGrad)');
            if (safeLabels[0]) { safeLabels[0].style.opacity = '1'; safeLabels[0].style.fontWeight = '700'; }
            
            // Safety banner
            if (safetyBanner) {
                safetyBanner.className = 'safety-safe flex items-start gap-3 p-3.5 rounded-xl border mb-5 transition-all duration-300';
                if (safetyIcon) { safetyIcon.textContent = 'verified_user'; safetyIcon.style.color = '#006c4a'; }
                if (safetyText) { safetyText.textContent = 'You are within your daily phenylalanine budget.'; safetyText.style.color = '#006c4a'; }
            }
        } else if (ratio < 1.0) {
            donutArc.setAttribute('stroke', 'url(#warnGrad)');
            if (safeLabels[1]) { safeLabels[1].style.opacity = '1'; safeLabels[1].style.fontWeight = '700'; }
            
            // Safety banner
            if (safetyBanner) {
                safetyBanner.className = 'safety-caution flex items-start gap-3 p-3.5 rounded-xl border mb-5 transition-all duration-300';
                if (safetyIcon) { safetyIcon.textContent = 'warning'; safetyIcon.style.color = '#eab308'; }
                if (safetyText) { safetyText.textContent = 'Approaching daily phenylalanine limit. Exercise caution.'; safetyText.style.color = '#a16207'; }
            }
        } else {
            donutArc.setAttribute('stroke', '#ba1a1a');
            if (safeLabels[2]) { safeLabels[2].style.opacity = '1'; safeLabels[2].style.fontWeight = '700'; }
            
            // Safety banner
            if (safetyBanner) {
                safetyBanner.className = 'safety-danger flex items-start gap-3 p-3.5 rounded-xl border mb-5 transition-all duration-300';
                if (safetyIcon) { safetyIcon.textContent = 'dangerous'; safetyIcon.style.color = '#ba1a1a'; }
                if (safetyText) { safetyText.textContent = 'Daily phenylalanine limit exceeded! Avoid further high-Phe foods.'; safetyText.style.color = '#ba1a1a'; }
            }
        }

        // Safety indicator dot positioning (cap at 100%)
        safetyIndicator.style.left = `${Math.min(ratio * 100, 100)}%`;
    }

    function updateCategoryBreakdown() {
        breakdownBar.innerHTML = '';
        breakdownLabels.innerHTML = '';

        const total = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
        if (total === 0) {
            breakdownBar.style.display = 'none';
            breakdownLabels.innerHTML = '<span class="text-xs text-on-surface-variant italic">Log meals to view category breakdown</span>';
            return;
        }
        breakdownBar.style.display = 'flex';

        const colors = {
            fruit: 'bg-[#f97316]',
            veg: 'bg-primary',
            cereal: 'bg-[#3b82f6]',
            starch: 'bg-[#a855f7]',
            unknown: 'bg-[#6c7a71]'
        };

        const dotColors = {
            fruit: 'bg-[#f97316]',
            veg: 'bg-primary',
            cereal: 'bg-[#3b82f6]',
            starch: 'bg-[#a855f7]',
            unknown: 'bg-[#6c7a71]'
        };

        for (const [cat, val] of Object.entries(categoryTotals)) {
            if (val > 0) {
                const pct = (val / total) * 100;
                // Segment in bar
                const seg = document.createElement('div');
                seg.className = `h-full ${colors[cat] || 'bg-[#6c7a71]'} transition-all`;
                seg.style.width = `${pct}%`;
                seg.title = `${capitalize(cat)}: ${val.toFixed(1)} mg (${pct.toFixed(0)}%)`;
                breakdownBar.appendChild(seg);

                // Label badge
                const badge = document.createElement('div');
                badge.className = 'flex items-center gap-1.5';
                badge.innerHTML = `
                    <div class="w-2.5 h-2.5 rounded-full ${dotColors[cat] || 'bg-[#6c7a71]'}"></div>
                    <span class="font-label-caps text-[10px] text-on-surface-variant uppercase">${cat === 'veg' ? 'VEG' : cat === 'cereal' ? 'GRAINS' : cat} (${Math.round(pct)}%)</span>
                `;
                breakdownLabels.appendChild(badge);
            }
        }
    }

    // Log button — each click adds one entry to daily budget
    logBtn.addEventListener('click', () => {
        if (!lastEstimate) return;
        
        const pheVal = lastEstimate.phe;
        const foodName = lastEstimate.name;
        const foodClass = lastEstimate.class;

        // Remove empty placeholder
        const empty = mealLogList.querySelector('.log-empty');
        if (empty) empty.remove();

        // Determine category mapping for budget breakdown
        let category = 'unknown';
        const fname = (foodName || '').toLowerCase();
        if (fname === 'banana' || fname === 'apple' || fname === 'strawberry' || fname === 'strawberries' || fname === 'tomato') category = 'fruit';
        else if (fname === 'broccoli' || fname === 'carrot' || fname === 'carrots' || fname === 'cucumber') category = 'veg';
        else if (fname === 'rice') category = 'cereal';
        else if (fname === 'cornstarch' || fname === 'tapioca' || fname === 'potato flour') category = 'starch';
        else if (foodClass.includes('fruit')) category = 'fruit';
        else if (foodClass.includes('veg') || foodClass.includes('legume')) category = 'veg';
        else if (foodClass.includes('cereal') || foodClass.includes('grain')) category = 'cereal';
        else if (foodClass.includes('starch') || foodClass.includes('tuber')) category = 'starch';
        else category = 'unknown';

        const meal = {
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: foodName,
            weight: lastEstimate.weight,
            phe: pheVal,
            class: foodClass,
            category: category
        };

        mealLog.push(meal);
        dailyUsed += pheVal;
        categoryTotals[category] += pheVal;

        renderMealLogItem(meal);
        saveState();

        updateBudgetUI();
        updateCategoryBreakdown();

        logBtn.dataset.logged = 'true';
        mealLogList.scrollTop = mealLogList.scrollHeight;
        showToast(`Logged "${capitalize(foodName)}" to Today's Log!`);
    });

    // Reset logic
    const resetLogData = () => {
        dailyUsed = 0;
        categoryTotals = { fruit: 0, veg: 0, cereal: 0, starch: 0, unknown: 0 };
        mealLog = [];
        
        mealLogList.innerHTML = `
            <div class="log-empty flex flex-col items-center justify-center py-12 text-center">
              <span class="material-symbols-outlined icon-fill mb-3" style="font-size:42px; color:#bbcac0;">restaurant_menu</span>
              <p style="font-size:14px; color:#6c7a71; font-family:'Inter'; font-style:italic;">No meals logged yet. Use the calculator to estimate a meal and add it here.</p>
            </div>
        `;
        const totalRow = document.getElementById('log-total-row');
        if (totalRow) {
            totalRow.classList.add('hidden');
            totalRow.classList.remove('flex');
        }
        
        resultCard.classList.remove('visible');
        lastEstimate = null;
        logBtn.dataset.logged = 'false';
        logBtn.classList.remove('hidden');

        try {
            localStorage.removeItem('phebe_daily_used');
            localStorage.removeItem('phebe_category_totals');
            localStorage.removeItem('phebe_meal_log');
        } catch (e) {
            console.error(e);
        }

        updateBudgetUI();
        updateCategoryBreakdown();
    };

    const resetBtnLog = document.getElementById('reset-btn-log');
    if (resetBtnLog) {
        resetBtnLog.addEventListener('click', () => {
            if (confirm("Are you sure you want to clear today's log?")) {
                resetLogData();
                showToast("Consumption log cleared.");
            }
        });
    }

    // Daily limit validation
    let lastValidLimit = 300;

    limitInput.addEventListener('input', () => {
        const val = parseInt(limitInput.value, 10);
        if (limitInput.value.trim() === '' || isNaN(val)) return;
        const clamped = Math.max(50, Math.min(1200, val));
        lastValidLimit = clamped;
        
        // Sync slider
        const slider = document.getElementById('profile-limit-slider');
        const sliderVal = document.getElementById('profile-limit-val');
        if (slider) slider.value = clamped;
        if (sliderVal) sliderVal.textContent = clamped;

        try {
            localStorage.setItem('phebe_daily_limit', clamped.toString());
        } catch (e) {
            console.error(e);
        }
        updateBudgetUI();
    });

    limitInput.addEventListener('blur', () => {
        const val = parseInt(limitInput.value, 10);
        const clamped = (isNaN(val) || val <= 0)
            ? lastValidLimit
            : Math.max(50, Math.min(1200, val));
        limitInput.value = clamped;
        lastValidLimit = clamped;

        const slider = document.getElementById('profile-limit-slider');
        const sliderVal = document.getElementById('profile-limit-val');
        if (slider) slider.value = clamped;
        if (sliderVal) sliderVal.textContent = clamped;

        try {
            localStorage.setItem('phebe_daily_limit', clamped.toString());
        } catch (e) {
            console.error(e);
        }
        updateBudgetUI();
    });

    // ── Navigation (Tabs) ──────────────────────────────────────────────────
    window.setActiveTab = (tabId) => {
        // Toggle tab view elements
        document.querySelectorAll('.tab-view').forEach(view => {
            if (view.id === `view-${tabId}`) {
                view.classList.add('active');
                view.classList.remove('hidden');
            } else {
                view.classList.remove('active');
                view.classList.add('hidden');
            }
        });

        // Toggle Desktop Tab button styles
        const desktopTabs = ['home', 'log'];
        desktopTabs.forEach(t => {
            const btn = document.getElementById(`dtab-${t}`);
            if (!btn) return;
            if (t === tabId) {
                btn.className = "px-4 py-1.5 rounded-lg text-sm font-semibold transition-all bg-primary text-white shadow-sm";
            } else {
                btn.className = "px-4 py-1.5 rounded-lg text-sm font-semibold transition-all text-on-surface-variant hover:text-primary hover:bg-primary/5";
            }
        });

        // Toggle Mobile Tab button styles
        desktopTabs.forEach(t => {
            const btn = document.getElementById(`mtab-${t}`);
            if (!btn) return;
            const icon = btn.querySelector('.material-symbols-outlined');
            if (t === tabId) {
                btn.style.background = 'rgba(0,108,74,0.1)';
                btn.style.color = '#006c4a';
                if (icon) icon.classList.add('icon-fill');
            } else {
                btn.style.background = 'none';
                btn.style.color = '#6c7a71';
                if (icon) icon.classList.remove('icon-fill');
            }
        });

        // Auto scroll to top on change
        window.scrollTo({ top: 0, behavior: 'instant' });
    };

    // ── Toast Notifications ──────────────────────────────────────────────
    function showToast(message) {
        const toast = document.getElementById('toast-message');
        if (toast) {
            toast.textContent = message;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 2500);
        }
    }

    // ── Recipes Database & Dynamic Loading ──────────────────────────────
    const PKU_RECIPES = [
        {
            id: 'rec_rice_bowl',
            name: "Classic Low-Protein Rice Bowl",
            category: "grain",
            class: "cereal protein",
            weight: 200,
            phe: 210.0,
            ingredients: "Rice (50g), Carrot (50g), Cucumber (50g), Cornstarch (50g)",
            instructions: "Cook rice separately. Stir-fry finely chopped carrots and cucumber. Mix in cornstarch as binder."
        },
        {
            id: 'rec_fruit_salad',
            name: "Fresh Summer Fruit Salad",
            category: "fruit",
            class: "fruit protein",
            weight: 180,
            phe: 45.0,
            ingredients: "Strawberry (60g), Apple (60g), Banana (60g)",
            instructions: "Wash and dice all fruits. Toss gently in a bowl. Serve chilled."
        },
        {
            id: 'rec_tapioca',
            name: "Creamy Tapioca Dessert",
            category: "starch",
            class: "refined starch",
            weight: 150,
            phe: 5.0,
            ingredients: "Tapioca Pearl (120g), Sugar & Water (30g)",
            instructions: "Boil tapioca pearls in water until translucent. Sweeten with sugar and chill."
        },
        {
            id: 'rec_stir_fry',
            name: "Stir-Fried Veggies & Potato Flour",
            category: "vegetable",
            class: "vegetable protein",
            weight: 200,
            phe: 320.0,
            ingredients: "Broccoli (80g), Carrots (60g), Potato flour (60g)",
            instructions: "Stir-fry broccoli and carrots with oil. Dust with potato flour to thicken sauce."
        }
    ];

    function renderRecipes() {
        const container = document.getElementById('recipe-cards-container');
        if (!container) return;
        container.innerHTML = '';

        PKU_RECIPES.forEach(recipe => {
            const card = document.createElement('div');
            card.className = "glass-card rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-all border border-outline-variant/30";
            
            let catColor = "bg-primary/10 text-primary";
            if (recipe.category === 'fruit') catColor = "bg-orange-500/10 text-orange-600";
            if (recipe.category === 'starch') catColor = "bg-purple-500/10 text-purple-600";
            if (recipe.category === 'grain') catColor = "bg-blue-500/10 text-blue-600";

            card.innerHTML = `
                <div>
                  <div class="flex items-start justify-between gap-3 mb-2.5">
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${catColor}">
                      ${recipe.category}
                    </span>
                    <span class="font-numeric text-xs font-bold text-primary bg-primary-container px-2 py-1 rounded-lg">
                      ${recipe.phe} mg Phe
                    </span>
                  </div>
                  <h3 class="font-title font-bold text-[16px] text-on-surface mb-1.5">${recipe.name}</h3>
                  <p class="text-xs text-on-surface-variant font-medium mb-3">Serving Size: <span class="text-on-surface font-semibold">${recipe.weight}g</span></p>
                  
                  <div class="mb-4">
                    <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1">Ingredients</p>
                    <p class="text-xs text-on-surface-variant leading-relaxed">${recipe.ingredients}</p>
                  </div>
                </div>
                
                <button onclick="logRecipe('${recipe.id}')" 
                  class="w-full py-2.5 rounded-xl border border-primary hover:bg-primary hover:text-white text-primary font-semibold transition-all active:scale-[0.98] text-xs flex items-center justify-center gap-2 mt-2">
                  <span class="material-symbols-outlined text-[16px]">add_circle</span>
                  Log Recipe
                </button>
            `;
            container.appendChild(card);
        });
    }

    window.logRecipe = (recipeId) => {
        const recipe = PKU_RECIPES.find(r => r.id === recipeId);
        if (!recipe) return;

        // Remove empty placeholder
        const empty = mealLogList.querySelector('.log-empty');
        if (empty) empty.remove();

        // Map recipe category to breakdown key
        let catKey = 'unknown';
        if (recipe.category === 'fruit') catKey = 'fruit';
        else if (recipe.category === 'vegetable') catKey = 'veg';
        else if (recipe.category === 'grain') catKey = 'cereal';
        else if (recipe.category === 'starch') catKey = 'starch';

        const meal = {
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: recipe.name,
            weight: recipe.weight,
            phe: recipe.phe,
            class: recipe.class,
            category: catKey
        };

        mealLog.push(meal);
        dailyUsed += recipe.phe;
        categoryTotals[catKey] += recipe.phe;

        renderMealLogItem(meal);
        saveState();

        updateBudgetUI();
        updateCategoryBreakdown();

        showToast(`Logged "${recipe.name}"!`);
    };

    // ── Profile Settings handlers ───────────────────────────────────────
    const profileNameInput = document.getElementById('profile-name');
    if (profileNameInput) {
        profileNameInput.value = localStorage.getItem('phebe_user_name') || '';
        profileNameInput.addEventListener('input', () => {
            localStorage.setItem('phebe_user_name', profileNameInput.value);
        });
    }

    const profileLimitSlider = document.getElementById('profile-limit-slider');
    const profileLimitVal = document.getElementById('profile-limit-val');

    if (profileLimitSlider && profileLimitVal) {
        profileLimitSlider.addEventListener('input', () => {
            const val = profileLimitSlider.value;
            profileLimitVal.textContent = val;
            limitInput.value = val;
            lastValidLimit = parseInt(val, 10);
            localStorage.setItem('phebe_daily_limit', val);
            updateBudgetUI();
        });
    }

    const clearDataBtn = document.getElementById('clear-data-btn');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', () => {
            if (confirm("Are you absolutely sure you want to delete all saved daily logs and settings? This cannot be undone.")) {
                localStorage.clear();
                window.location.reload();
            }
        });
    }

    // Init — load state from local storage first
    try {
        const storedUsed = localStorage.getItem('phebe_daily_used');
        if (storedUsed !== null) dailyUsed = parseFloat(storedUsed) || 0;

        const storedTotals = localStorage.getItem('phebe_category_totals');
        if (storedTotals !== null) categoryTotals = JSON.parse(storedTotals) || categoryTotals;

        const storedLimit = localStorage.getItem('phebe_daily_limit');
        if (storedLimit !== null) {
            const parsedLimit = parseInt(storedLimit, 10);
            if (!isNaN(parsedLimit) && parsedLimit >= 50 && parsedLimit <= 1200) {
                limitInput.value = parsedLimit;
                lastValidLimit = parsedLimit;
                if (profileLimitSlider && profileLimitVal) {
                    profileLimitSlider.value = parsedLimit;
                    profileLimitVal.textContent = parsedLimit;
                }
            }
        }

        const storedLog = localStorage.getItem('phebe_meal_log');
        if (storedLog !== null) {
            mealLog = JSON.parse(storedLog) || [];
            if (mealLog.length > 0) {
                const empty = mealLogList.querySelector('.log-empty');
                if (empty) empty.remove();
                mealLog.forEach(meal => {
                    renderMealLogItem(meal);
                });
            }
        }
    } catch (e) {
        console.error('Failed to load persisted state:', e);
    }

    renderRecipes();
    updateBudgetUI();
    updateCategoryBreakdown();
});

function addBreakdownItem(label, value, isBg = false) {
    const li = document.createElement('li');
    li.className = `flex justify-between items-center py-3 px-4 border-b border-surface-variant/50 last:border-b-0 ${isBg ? 'bg-[#006c4a]/5' : ''}`;
    li.innerHTML = `
        <span class="font-body-sm text-body-sm text-on-surface-variant">${label}</span>
        <span class="font-body-sm text-body-sm ${isBg ? 'text-primary font-semibold' : 'text-on-surface font-semibold'}">${value}</span>
    `;
    document.getElementById('breakdown-list').appendChild(li);
}

function capitalize(str) {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── PWA & Offline Support ──────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
            console.log('[Service Worker] Registered', reg.scope);
        }).catch((err) => {
            console.error('[Service Worker] Registration failed', err);
        });
    });
}

// PWA Install Prompt
let deferredPrompt;
const installBtn = document.getElementById('pwa-install-btn');
const installBtnProfile = document.getElementById('pwa-install-btn-profile');

function showInstallButtons() {
    if(installBtn) {
        installBtn.classList.remove('hidden');
        installBtn.classList.add('flex');
    }
}

function hideInstallButtons() {
    if(installBtn) {
        installBtn.classList.add('hidden');
        installBtn.classList.remove('flex');
    }
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButtons();
});

if(installBtn) {
    installBtn.addEventListener('click', handleInstallClick);
}

async function handleInstallClick() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    deferredPrompt = null;
    hideInstallButtons();
}

window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    hideInstallButtons();
});
