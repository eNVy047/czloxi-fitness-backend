export interface ICalculationResult {
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  waterGlasses: number;
  stepGoal: number;
  caloriesBurntGoal: number;
  sleepGoal: number;
  bmi: number;
  bmr: number;
  tdee: number;
}

/**
 * Calculate BMI
 */
export const calculateBMI = (weightKg: number, heightCm: number): number => {
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(2));
};

/**
 * Calculate Base BMR using Harris-Benedict Formula
 */
export const calculateBMR = (age: number, gender: string, weightKg: number, heightCm: number): number => {
  if (gender === 'female') {
    return 447.593 + (9.247 * weightKg) + (3.098 * heightCm) - (4.330 * age);
  }
  // Default to male calculation for 'male' and 'other' for estimation
  return 88.362 + (13.397 * weightKg) + (4.799 * heightCm) - (5.677 * age);
};

/**
 * Calculate TDEE (Total Daily Energy Expenditure) 
 * based on Activity Level & Fitness Goal
 */
export const calculateTDEE = (bmr: number, activityLevel: string, fitnessGoal: string): number => {
  let activityMultiplier = 1.2; // sedentary

  switch (activityLevel) {
    case 'light': activityMultiplier = 1.375; break;
    case 'moderate': activityMultiplier = 1.55; break;
    case 'active': activityMultiplier = 1.725; break;
    case 'very_active': activityMultiplier = 1.9; break;
  }

  const tdee = bmr * activityMultiplier;

  // Adjust the daily calories based on the goal
  switch (fitnessGoal) {
    case 'lose_weight': return Math.round(tdee - 500); // Create deficit
    case 'build_muscle': return Math.round(tdee + 300); // Create surplus
    case 'stay_fit':
    default:
      return Math.round(tdee); // Maintenance
  }
};

/**
 * Calculate all dynamic user goals from profile
 */
export const calculateGoals = (profile: {
  age: number;
  gender: string;
  weightKg: number;
  heightCm: number;
  activityLevel: string;
  fitnessGoal: string;
  targetWeight?: number | undefined;
}): ICalculationResult => {
  const bmr = calculateBMR(profile.age, profile.gender, profile.weightKg, profile.heightCm);
  const tdee = calculateTDEE(bmr, profile.activityLevel, profile.fitnessGoal);
  const calorieGoal = tdee;

  // Macro split
  const proteinGoal = Math.round((calorieGoal * 0.30) / 4);
  const carbsGoal = Math.round((calorieGoal * 0.40) / 4);
  const fatGoal = Math.round((calorieGoal * 0.30) / 9);

  // Water
  const waterGoalLiters = profile.weightKg * 0.033;
  const waterGlasses = Math.round(waterGoalLiters / 0.25);

  // Steps based on activity level
  let stepGoal = 8000;
  switch (profile.activityLevel) {
    case 'light': stepGoal = 10000; break;
    case 'moderate': stepGoal = 12000; break;
    case 'active':
    case 'very_active': stepGoal = 15000; break;
  }

  // --- Step 1 & 2: Base Calorie Burn Goal (Percentage of TDEE based on Fitness Goal) ---
  let caloriesBurntGoal = 0;
  switch (profile.fitnessGoal) {
    case 'lose_weight':
      caloriesBurntGoal = calorieGoal * 0.20; // 20%
      break;
    case 'build_muscle':
      caloriesBurntGoal = calorieGoal * 0.10; // 10%
      break;
    case 'stay_fit':
    default:
      caloriesBurntGoal = calorieGoal * 0.15; // 15%
      break;
  }

  // --- Step 3: BMI Adjustment ---
  const bmi = calculateBMI(profile.weightKg, profile.heightCm);
  if (bmi > 30) {
    caloriesBurntGoal += 100;
  } else if (bmi >= 25) {
    caloriesBurntGoal += 50;
  } else if (bmi < 18.5) {
    caloriesBurntGoal -= 50;
  }

  // --- Step 4: Age Adjustment ---
  if (profile.age < 25) {
    caloriesBurntGoal *= 1.1;
  } else if (profile.age > 45) {
    caloriesBurntGoal *= 0.9;
  }

  // --- Step 5: Weight Gap Adjustment ---
  if (profile.targetWeight) {
    const weightDiff = profile.weightKg - profile.targetWeight;
    if (weightDiff > 10) {
      caloriesBurntGoal += 150;
    } else if (weightDiff >= 5) {
      caloriesBurntGoal += 75;
    }
  }

  // Finalize goal (ensure it isn't negative or zero)
  caloriesBurntGoal = Math.max(100, Math.round(caloriesBurntGoal));

  // Sleep goal based on age
  let sleepGoal = 8;
  if (profile.age < 18) sleepGoal = 9;
  else if (profile.age > 60) sleepGoal = 7;

  return {
    calorieGoal,
    proteinGoal,
    carbsGoal,
    fatGoal,
    waterGlasses,
    stepGoal,
    caloriesBurntGoal,
    sleepGoal,
    bmi,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
  };
};
