// Typical signs of common dairy-cattle conditions. Each description is
// embedded with the same model as the vet notes; a note is matched to
// the condition whose description is closest in meaning (cosine).
export const CONDITION_PROFILES = [
  { condition: 'Mastitis', signs: 'Udder or quarter swollen, hot, hard and painful. Milk watery or with clots, flakes or blood. Cow kicks during milking.' },
  { condition: 'Foot Rot', signs: 'Lame with swelling between the claws of the hoof and a foul smell from the foot.' },
  { condition: 'Lameness', signs: 'Limping, stiff walk or arched back, sore feet, overgrown or bruised hooves, reluctant to bear weight.' },
  { condition: 'Milk Fever', signs: 'Shortly after calving the cow is down and unable to rise, cold ears, muscle tremors, weak, head turned to the flank.' },
  { condition: 'Ketosis', signs: 'Weeks after calving: drop in milk, refuses concentrate feed, loses body condition, sweet fruity breath, ketones in urine.' },
  { condition: 'Bloat', signs: 'Left side of the abdomen swollen and tight like a drum after grazing lush green fodder, discomfort, laboured breathing.' },
  { condition: 'Respiratory Infection', signs: 'Coughing, nasal discharge, fast breathing and fever, often several animals in the same pen.' },
  { condition: 'Pneumonia', signs: 'Calf with difficult open-mouth breathing, crackling lung sounds and high fever, poor suckling.' },
  { condition: 'Calf Scours', signs: 'Calf with diarrhoea, watery or loose dung, dehydration, sunken eyes, weakness.' },
  { condition: 'Tick Fever', signs: 'Fever, red urine, pale or anaemic gums and membranes, weakness, ticks on the body.' },
  { condition: 'Retained Placenta', signs: 'Afterbirth not expelled after calving, foul smelling discharge from the uterus.' },
  { condition: 'Foot and Mouth Disease', signs: 'Blisters on the tongue, gums and between the hooves, drooling saliva, high fever, spreads between farms.' },
  { condition: 'Healthy', signs: 'Routine check, animal healthy, normal temperature, good appetite and body condition, no abnormalities found.' },
];
