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

// Serverless Clinical Phe Estimator (perfect port of Python precision_yield_estimator.py)
function estimatePheLocal(foodName, weight) {
    const n = foodName.toLowerCase();
    
    // Fuzzy stem match (mirrors foodlist.py exactly)
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
            }]
        }
    };
}


document.addEventListener('DOMContentLoaded', () => {
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

    // Always light mode
    document.documentElement.classList.remove('dark');
    document.body.style.backgroundColor = '#f8fafc';
    document.body.style.color = '#0f172a';

    // ── Autocomplete Logic ────────────────────────────────────────────────
    foodNameInput.addEventListener('input', function() {
        const val = this.value.toLowerCase();
        autocompleteList.innerHTML = '';
        
        if (!val) {
            autocompleteList.classList.add('hidden');
            return;
        }
        
        const isDark = document.documentElement.classList.contains('dark');
        
        // Style the dropdown container per theme
        autocompleteList.style.backgroundColor = isDark ? '#1c1f2a' : '#ffffff';
        autocompleteList.style.borderColor = isDark ? 'rgba(60,74,66,0.8)' : '#e2e8f0';
        autocompleteList.style.color = isDark ? '#dfe2f1' : '#1e293b';
        
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
                
                item.innerHTML = `${before}<strong class="text-emerald-600 dark:text-primary">${match}</strong>${after}`;
                
                // Apply direct styles for theme awareness
                item.style.cssText = `
                    padding: 8px 16px;
                    cursor: pointer;
                    font-size: 14px;
                    border-bottom: 1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'};
                    color: ${isDark ? '#dfe2f1' : '#1e293b'};
                    transition: background 0.15s ease, color 0.15s ease;
                `;
                
                item.addEventListener('mouseenter', () => {
                    item.style.backgroundColor = isDark ? 'rgba(78,222,163,0.12)' : 'rgba(5,150,105,0.08)';
                    item.style.color = isDark ? '#4edea3' : '#059669';
                });
                item.addEventListener('mouseleave', () => {
                    item.style.backgroundColor = '';
                    item.style.color = isDark ? '#dfe2f1' : '#1e293b';
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
        
        const foodNameVal = foodNameInput.value.toLowerCase().trim();
        const foodWeight = parseFloat(foodWeightInput.value);
        
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
            foodWeightInput.style.borderColor = '#ef4444';
            foodWeightInput.style.boxShadow = '0 0 0 2px rgba(239,68,68,0.2)';
            let errMsg = document.createElement('p');
            errMsg.id = 'food-weight-error';
            errMsg.style.cssText = 'color:#ef4444;font-size:12px;margin-top:4px;';
            errMsg.textContent = 'Please enter a valid positive weight.';
            foodWeightInput.parentElement.after(errMsg);
            hasError = true;
        }

        // Validate food name
        if (!foodNameVal) {
            hasError = true;
        } else {
            const isInDatabase = Object.keys(FOOD_DATABASE).some(key => key === foodNameVal);
            if (!isInDatabase) {
                foodNameInput.style.borderColor = '#ef4444';
                foodNameInput.style.boxShadow = '0 0 0 2px rgba(239,68,68,0.2)';
                let errMsg = document.createElement('p');
                errMsg.id = 'food-name-error';
                errMsg.style.cssText = 'color:#ef4444;font-size:12px;margin-top:4px;';
                foodNameInput.parentElement.after(errMsg);
                errMsg.textContent = `"${foodNameVal}" is not in the verified food list. Please pick from the dropdown suggestions.`;
                hasError = true;
            }
        }

        if (hasError) return;
        
        // Show loading state
        breakdownList.innerHTML = '';
        pheResult.innerHTML = '<span class="material-symbols-outlined animate-spin text-2xl">sync</span>';
        resultCard.classList.remove('hidden');

        const submitBtn = form.querySelector('button[type="submit"]');
        isEstimating = true;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">sync</span> Estimating...';
            submitBtn.style.opacity = '0.7';
        }
        
        try {
            // Minimum 400ms loading so user SEES the spinner (visual feedback on re-estimate)
            const [data] = await Promise.all([
                new Promise(resolve => {
                    const res = estimatePheLocal(foodNameVal, foodWeight);
                    resolve(res);
                }),
                new Promise(r => setTimeout(r, 400))
            ]);
            
            const phe = data.phe_mg;
            const meta = data.meta;
            
            // Render Result with pop animation (shows user it was recalculated)
            pheResult.innerText = phe.toFixed(1);
            pheResult.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
            pheResult.style.transform = 'scale(1.15)';
            pheResult.style.opacity = '0.7';
            setTimeout(() => {
                pheResult.style.transform = 'scale(1)';
                pheResult.style.opacity = '1';
            }, 200);
            
            // Add breakdown items based on backend response
            const considered = meta.ingredients_considered || [];
            const isSafe = considered.length > 0 && considered.every(i => i.phe_source_class === 'whole food (food-list)');
            
            if (isSafe) {
                // Clinically Verified — show log button
                logBtn.classList.remove('hidden');
                
                const badge = document.querySelector('.status-badge');
                badge.innerHTML = `<span class="material-symbols-outlined badge-icon" style="font-size:14px;font-variation-settings:'FILL' 1;color:#059669;">verified</span> Clinically Verified`;
                badge.className = 'status-badge verified-active';
                badge.style.cssText = `
                    display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px; border-radius: 9999px;
                    font-size: 10px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;
                    background-color: rgba(5,150,105,0.08);
                    border: 1px solid rgba(5,150,105,0.2);
                    color: #059669;
                `;
                
                addBreakdownItem('nutrition', 'Food', capitalize(foodNameVal));
                addBreakdownItem('scale', 'Amount', `${meta.portion_g}g`);
                addBreakdownItem('biotech', 'Estimated Phe', `${meta.recipe_factor_mg_per_serving} mg (before safety)`);
                addBreakdownItem('shield', 'Safety Buffer Added', '<strong style="color:#059669;">Yes ✔</strong>');
                
                lastEstimate = {
                    name: foodNameVal,
                    phe: phe,
                    class: meta.ingredients_considered[0]?.phe_source_class || 'unknown',
                    weight: foodWeight
                };
                
                logBtn.dataset.logged = 'false';
            } else {
                // Needs review — hide log button, user cannot add unverified food to budget
                logBtn.classList.add('hidden');
                // Needs review
                const badge = document.querySelector('.status-badge');
                badge.innerHTML = `<span class="material-symbols-outlined badge-icon" style="font-size:14px;font-variation-settings:'FILL' 1;color:#d97706;">info</span> Needs Review`;
                badge.className = 'status-badge danger-active';
                badge.style.cssText = `
                    display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px; border-radius: 9999px;
                    font-size: 10px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;
                    background-color: rgba(217,119,6,0.08);
                    border: 1px solid rgba(217,119,6,0.25);
                    color: #d97706;
                `;
                
                addBreakdownItem('info', 'Status', '<span style="color:#d97706;font-weight:500;">Consult your dietitian for this food</span>');
                
                lastEstimate = null;
            }
            
        } catch (err) {
            console.error(err);
            pheResult.innerText = '--';
            resultCard.classList.add('hidden');
            // Show a gentle inline error on the form
            let errBanner = document.getElementById('form-error-banner');
            if (!errBanner) {
                errBanner = document.createElement('div');
                errBanner.id = 'form-error-banner';
                errBanner.style.cssText = 'margin-top:12px;padding:10px 14px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;color:#dc2626;font-size:13px;display:flex;align-items:center;gap:8px;';
                errBanner.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">wifi_off</span> Could not calculate right now. Please try again.';
                form.appendChild(errBanner);
                setTimeout(() => errBanner.remove(), 4000);
            }
            lastEstimate = null;
        } finally {
            isEstimating = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Estimate Phe <span class="material-symbols-outlined text-sm">arrow_forward</span>';
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
            if (!foodClass) return { name: 'help_center', bg: 'bg-slate-100 dark:bg-slate-500/10', color: 'text-slate-500 dark:text-slate-400' };
            const fc = foodClass.toLowerCase();
            
            if (fc.includes('cereal') || fc.includes('starch')) return { name: 'bakery_dining', bg: 'bg-amber-100 dark:bg-amber-500/10', color: 'text-amber-600 dark:text-amber-400' };
            if (fc.includes('fruit')) return { name: 'nutrition', bg: 'bg-orange-100 dark:bg-orange-500/10', color: 'text-orange-600 dark:text-orange-400' };
            if (fc.includes('veg') || fc.includes('legume')) return { name: 'eco', bg: 'bg-emerald-100 dark:bg-emerald-500/10', color: 'text-emerald-600 dark:text-emerald-400' };
            if (fc.includes('dairy')) return { name: 'water_drop', bg: 'bg-blue-100 dark:bg-blue-500/10', color: 'text-blue-600 dark:text-blue-400' };
            if (fc.includes('whole food')) return { name: 'verified', bg: 'bg-emerald-100 dark:bg-emerald-500/10', color: 'text-emerald-600 dark:text-emerald-400' };
            
            return { name: 'help_center', bg: 'bg-slate-100 dark:bg-slate-500/10', color: 'text-slate-500 dark:text-slate-400' };
        }
        
        const ico = getIconForClass(meal.class);

        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-white dark:bg-surface-container rounded-lg p-2.5 border border-slate-200 dark:border-white/5 group transition-all';
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="${ico.bg} p-1.5 rounded-md ${ico.color} flex items-center justify-center">
                    <span class="material-symbols-outlined text-[16px]">${ico.name}</span>
                </div>
                <div class="flex flex-col">
                    <span class="font-body-sm text-slate-800 dark:text-on-surface">${capitalize(meal.name)}</span>
                    <span class="font-label-caps text-[10px] text-slate-500 dark:text-on-surface-variant">${capitalize(meal.class)} • ${meal.weight}g</span>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <span class="font-body-lg font-medium text-emerald-600 dark:text-primary">+${meal.phe.toFixed(1)}</span>
                <button class="delete-log-btn text-slate-400 hover:text-rose-500 p-1 rounded-full flex items-center justify-center" title="Delete this entry">
                    <span class="material-symbols-outlined text-[16px]">close</span>
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

            div.remove();
            
            if (mealLogList.children.length === 0) {
                mealLogList.innerHTML = '<div class="log-empty text-center text-slate-500 font-body-sm italic py-4">No meals logged yet</div>';
            }

            logBtn.dataset.logged = 'false';

            saveState();
            updateBudgetUI();
            updateCategoryBreakdown();
        });

        mealLogList.appendChild(div);
    }

    const donutArc          = document.getElementById('donut-arc');
    const budgetUsed        = document.getElementById('budget-used');
    const budgetRem         = document.getElementById('budget-remaining');
    const safetyIndicator   = document.getElementById('safety-indicator');
    const mealLogList       = document.getElementById('meal-log-list');
    const limitInput        = document.getElementById('daily-limit');
    const limitDisplay      = document.getElementById('daily-limit-display');
    const breakdownBar      = document.getElementById('category-breakdown-bar');
    const breakdownLabels   = document.getElementById('category-breakdown-labels');

    const CIRCUMFERENCE = 251.2; // 2 * PI * 40 (matches new radius of 40)

    function updateBudgetUI() {
        const limit = parseFloat(limitInput.value) || 300;
        const ratio = Math.min(dailyUsed / limit, 1);
        const offset = CIRCUMFERENCE * (1 - ratio);

        // Donut arc
        donutArc.style.strokeDashoffset = offset;
        budgetUsed.textContent = Math.round(dailyUsed);
        
        const remaining = Math.max(limit - dailyUsed, 0);
        budgetRem.textContent = remaining > 0
            ? `${Math.round(remaining)} mg left`
            : '⚠ Limit Reached';

        // Color transitions based on ratio
        const safeLabels = document.querySelectorAll('.safety-label');
        safeLabels.forEach(l => {
            l.className = l.className.replace(' active font-bold text-primary text-yellow-500 text-error', '');
            l.style.opacity = '0.4';
        });

        if (ratio < 0.7) {
            donutArc.setAttribute('stroke', 'url(#emeraldGradient)');
            budgetRem.className = 'font-body-sm text-primary';
            safeLabels[0].className += ' active font-bold text-primary';
            safeLabels[0].style.opacity = '1';
        } else if (ratio < 1.0) {
            donutArc.setAttribute('stroke', 'url(#warnGradient)');
            budgetRem.className = 'font-body-sm text-yellow-500';
            safeLabels[1].className += ' active font-bold text-yellow-500';
            safeLabels[1].style.opacity = '1';
        } else {
            donutArc.setAttribute('stroke', '#ffb4ab');
            budgetRem.className = 'font-body-sm text-error';
            safeLabels[2].className += ' active font-bold text-error';
            safeLabels[2].style.opacity = '1';
        }

        // Safety indicator left offset percentage (cap at 100%)
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
            fruit: 'bg-orange-400/80',
            veg: 'bg-emerald-500/80',
            cereal: 'bg-blue-500/80',
            starch: 'bg-purple-500/80',
            unknown: 'bg-slate-500/80'
        };

        const dotColors = {
            fruit: 'bg-orange-400',
            veg: 'bg-emerald-500',
            cereal: 'bg-blue-500',
            starch: 'bg-purple-500',
            unknown: 'bg-slate-500'
        };

        for (const [cat, val] of Object.entries(categoryTotals)) {
            if (val > 0) {
                const pct = (val / total) * 100;
                // Segment in bar
                const seg = document.createElement('div');
                seg.className = `h-full ${colors[cat] || 'bg-slate-500/80'} border-r border-background last:border-r-0`;
                seg.style.width = `${pct}%`;
                seg.title = `${capitalize(cat)}: ${val.toFixed(1)} mg (${pct.toFixed(0)}%)`;
                breakdownBar.appendChild(seg);

                // Label badge
                const badge = document.createElement('div');
                badge.className = 'flex items-center gap-1.5';
                badge.innerHTML = `
                    <div class="w-2 h-2 rounded-full ${dotColors[cat] || 'bg-slate-500/80'}"></div>
                    <span class="font-label-caps text-[10px] text-slate-800 dark:text-on-surface">${capitalize(cat === 'veg' ? 'Vegetables' : cat === 'cereal' ? 'Grains' : cat)} (${Math.round(pct)}%)</span>
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
    });

    // Reset button — clears log, budget, and hides result card
    document.getElementById('reset-btn').addEventListener('click', () => {
        dailyUsed = 0;
        categoryTotals = { fruit: 0, veg: 0, cereal: 0, starch: 0, unknown: 0 };
        mealLog = [];
        mealLogList.innerHTML = '<div class="log-empty text-center text-slate-500 font-body-sm italic py-4">No meals logged yet</div>';
        
        resultCard.classList.add('hidden');
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
    });

    // Daily limit validation
    let lastValidLimit = 300;

    limitInput.addEventListener('input', () => {
        const val = parseInt(limitInput.value, 10);
        if (limitInput.value.trim() === '' || isNaN(val)) return;
        const clamped = Math.max(50, Math.min(1200, val));
        lastValidLimit = clamped;
        limitDisplay.textContent = clamped;
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
        limitDisplay.textContent = clamped;
        try {
            localStorage.setItem('phebe_daily_limit', clamped.toString());
        } catch (e) {
            console.error(e);
        }
        updateBudgetUI();
    });

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
                limitDisplay.textContent = parsedLimit;
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

    updateBudgetUI();
    updateCategoryBreakdown();
});

function addBreakdownItem(icon, label, value) {
    const li = document.createElement('li');
    li.className = 'flex justify-between items-center pb-2 border-b border-slate-100 dark:border-white/5 last:border-0 text-[14px]';
    li.innerHTML = `
        <span class="flex items-center gap-2 text-slate-500 dark:text-[#bbcabf]">
            <span class="material-symbols-outlined text-[16px] text-emerald-600 dark:text-[#4edea3]">${icon}</span>
            ${label}
        </span>
        <span class="font-semibold text-slate-800 dark:text-[#dfe2f1]">${value}</span>
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

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    deferredPrompt = e;
    // Show install button
    if(installBtn) installBtn.classList.remove('hidden');
});

if(installBtn) {
    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        deferredPrompt = null;
        installBtn.classList.add('hidden');
    });
}

window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    if(installBtn) installBtn.classList.add('hidden');
});


