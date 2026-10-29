type Props = { step: number };

const labels = [
  'Изделие перед упаковкой',
  'Пузырчатая плёнка защищает изделие',
  'Коробка с наполнителем',
  'Закрытая коробка, рулетка и весы',
  'Посылка с этикеткой и пункт CDEK'
];

export const PackingStepIllustration = ({ step }: Props) => (
  <svg role="img" aria-label={labels[step]} viewBox="0 0 640 280" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="packing-box" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#66a5ff" /><stop offset="1" stopColor="#2f7cff" />
      </linearGradient>
      <linearGradient id="packing-product" x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#b2c9ff" /><stop offset="1" stopColor="#6c8fd8" />
      </linearGradient>
    </defs>
    <ellipse cx="320" cy="245" rx="210" ry="18" fill="#050b20" opacity=".28" />

    {step === 0 && <g>
      <rect x="180" y="211" width="280" height="17" rx="8" fill="#233d70" />
      <path d="M250 203V99l40-37h60l40 37v104Z" fill="url(#packing-product)" stroke="#d6e5ff" strokeWidth="5" strokeLinejoin="round" />
      <path d="M286 203v-91h68v91M250 139h140M250 169h140" fill="none" stroke="#5376bd" strokeWidth="5" opacity=".58" />
      <path d="m418 81 15 15 29-30" fill="none" stroke="#1dd1a1" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="179" cy="86" r="7" fill="#f7b731" /><circle cx="477" cy="149" r="5" fill="#f7b731" />
      <path d="M198 68v-17m-9 9h18M474 93V77m-8 8h16" stroke="#f7b731" strokeWidth="4" strokeLinecap="round" />
    </g>}

    {step === 1 && <g>
      <path d="M205 205V102l43-34h65l43 34v103Z" fill="url(#packing-product)" stroke="#d6e5ff" strokeWidth="5" />
      <path d="M238 78c49-43 131-36 167 9 36 47 17 112-36 133-54 22-129 1-152-47-20-42-12-71 21-95Z"
        fill="#8edfff" fillOpacity=".25" stroke="#86dcff" strokeWidth="7" strokeDasharray="12 8" />
      {[0, 1, 2, 3, 4].map((row) => [0, 1, 2, 3, 4, 5].map((column) => (
        <circle key={`${row}-${column}`} cx={235 + column * 30 + (row % 2) * 12} cy={84 + row * 27} r="7" fill="#b9f0ff" fillOpacity=".48" stroke="#8edfff" strokeWidth="2" />
      )))}
      <rect x="414" y="169" width="72" height="48" rx="20" fill="#286bba" stroke="#86dcff" strokeWidth="5" />
      <ellipse cx="418" cy="193" rx="19" ry="24" fill="#173d72" stroke="#86dcff" strokeWidth="5" />
    </g>}

    {step === 2 && <g>
      <path d="M210 108h220v115H210Z" fill="url(#packing-box)" stroke="#a9c9ff" strokeWidth="5" />
      <path d="m210 108-35-40h94l51 40m110 0 35-40h-94l-51 40" fill="#8cbbff" stroke="#c7dcff" strokeWidth="5" strokeLinejoin="round" />
      <path d="M270 186v-65l25-20h50l25 20v65Z" fill="url(#packing-product)" stroke="#d6e5ff" strokeWidth="4" />
      <path d="m222 139 13 12-11 13 15 10m179-34-13 12 12 12-15 10m-174 20 12-9 9 10m154-10 10-11 10 8"
        fill="none" stroke="#1dd1a1" strokeWidth="6" strokeLinecap="round" />
      <path d="M320 109v114" stroke="#a9c9ff" strokeWidth="4" opacity=".7" />
    </g>}

    {step === 3 && <g>
      <rect x="175" y="209" width="290" height="24" rx="9" fill="#203c6e" stroke="#70a4ff" strokeWidth="4" />
      <path d="M206 100h225v108H206Z" fill="url(#packing-box)" stroke="#b9d2ff" strokeWidth="5" />
      <path d="M206 100h225l-28-32H233Z" fill="#8abaff" stroke="#c7dcff" strokeWidth="5" />
      <path d="M319 69v139" stroke="#d5e6ff" strokeWidth="13" opacity=".8" />
      <rect x="452" y="81" width="34" height="126" rx="7" fill="#f7b731" transform="rotate(13 452 81)" />
      <path d="m461 90 18 4m-18 15 18 4m-18 15 18 4m-18 15 18 4m-18 15 18 4" stroke="#8b5b16" strokeWidth="3" />
      <rect x="115" y="166" width="74" height="49" rx="12" fill="#1dd1a1" stroke="#a6ffdf" strokeWidth="4" />
      <path d="M126 182h51m-33 16h20" stroke="#0d4050" strokeWidth="5" strokeLinecap="round" />
    </g>}

    {step === 4 && <g>
      <path d="M353 100h166v123H353Z" fill="#223d70" stroke="#83afff" strokeWidth="5" />
      <path d="M342 100h188l-20-38H363Z" fill="url(#packing-box)" stroke="#a9c9ff" strokeWidth="5" />
      <rect x="373" y="117" width="68" height="71" rx="7" fill="#90b7ff" opacity=".58" />
      <rect x="454" y="117" width="47" height="106" rx="6" fill="#132c57" stroke="#90b7ff" strokeWidth="4" />
      <text x="437" y="87" textAnchor="middle" fill="white" fontSize="21" fontWeight="800" fontFamily="Arial, sans-serif">CDEK</text>
      <path d="M165 130h128v92H165Z" fill="url(#packing-box)" stroke="#bed6ff" strokeWidth="5" />
      <path d="M165 130h128l-17-25h-94Z" fill="#8abaff" stroke="#bed6ff" strokeWidth="4" />
      <rect x="211" y="153" width="64" height="43" rx="4" fill="#e9f2ff" />
      <path d="M220 162h46m-46 9h37m-37 9h46" stroke="#466ea8" strokeWidth="3" />
      <path d="M291 167h38m-9-9 10 9-10 9" fill="none" stroke="#1dd1a1" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </g>}
  </svg>
);
