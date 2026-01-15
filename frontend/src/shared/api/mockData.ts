import { Order, Product } from '../types';

export const products: Product[] = [
  {
    id: 'p1',
    title: 'Мини-дрон Falcon X',
    category: 'Гаджеты',
    price: 4200,
    image: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=800&q=80',
    description: 'Компактный дрон для съемки в помещении и на улице.',
    material: 'PLA',
    size: '120×90×35 мм',
    technology: 'FDM',
    printTime: '6 часов',
    color: 'Черный'
  },
  {
    id: 'p2',
    title: 'Архитектурный макет Loft',
    category: 'Архитектура',
    price: 6800,
    image: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=800&q=80',
    description: 'Детализированный макет современного лофта.',
    material: 'PLA',
    size: '240×160×90 мм',
    technology: 'FDM',
    printTime: '12 часов',
    color: 'Белый'
  },
  {
    id: 'p3',
    title: 'Фигурка кибер-самурая',
    category: 'Фигурки',
    price: 3500,
    image: 'https://images.unsplash.com/photo-1472457897821-70d3819a0e24?auto=format&fit=crop&w=800&q=80',
    description: 'Коллекционная фигурка с высокой детализацией.',
    material: 'RESIN',
    size: '180×80×60 мм',
    technology: 'SLA',
    printTime: '9 часов',
    color: 'Стальной'
  },
  {
    id: 'p4',
    title: 'Органайзер для мастерской',
    category: 'Интерьер',
    price: 1200,
    image: 'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=800&q=80',
    description: 'Модульный органайзер для инструментов и фурнитуры.',
    material: 'PETG',
    size: '200×150×80 мм',
    technology: 'FDM',
    printTime: '4 часа',
    color: 'Графит'
  },
  {
    id: 'p5',
    title: 'Лампа Nebula',
    category: 'Интерьер',
    price: 5200,
    image: 'https://images.unsplash.com/photo-1493666438817-866a91353ca9?auto=format&fit=crop&w=800&q=80',
    description: 'Светильник с диффузором, создающий мягкое свечение.',
    material: 'PLA',
    size: '220×220×160 мм',
    technology: 'FDM',
    printTime: '10 часов',
    color: 'Айвори'
  },
  {
    id: 'p6',
    title: 'Панель для кастомного ПК',
    category: 'Гаджеты',
    price: 4100,
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
    description: 'Перфорированная панель для кастомного корпуса.',
    material: 'ABS',
    size: '300×180×25 мм',
    technology: 'FDM',
    printTime: '7 часов',
    color: 'Темно-серый'
  },
  {
    id: 'p7',
    title: 'Набор шахмат Aurora',
    category: 'Игры',
    price: 5600,
    image: 'https://images.unsplash.com/photo-1455885666463-1ea45e40c025?auto=format&fit=crop&w=800&q=80',
    description: 'Шахматы с полупрозрачными фигурами.',
    material: 'RESIN',
    size: '320×320×40 мм',
    technology: 'SLA',
    printTime: '14 часов',
    color: 'Прозрачный дым'
  },
  {
    id: 'p8',
    title: 'Держатель для наушников Orbit',
    category: 'Интерьер',
    price: 1600,
    image: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=800&q=80',
    description: 'Эргономичная подставка для игровых наушников.',
    material: 'PETG',
    size: '140×120×180 мм',
    technology: 'FDM',
    printTime: '3 часа',
    color: 'Синий'
  },
  {
    id: 'p9',
    title: 'Модульная полка Hive',
    category: 'Интерьер',
    price: 4800,
    image: 'https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=800&q=80',
    description: 'Система полок с сотами для декора.',
    material: 'PLA',
    size: '400×300×120 мм',
    technology: 'FDM',
    printTime: '11 часов',
    color: 'Песочный'
  },
  {
    id: 'p10',
    title: 'Прототип медицинского устройства',
    category: 'Прототипы',
    price: 8900,
    image: 'https://images.unsplash.com/photo-1486825586573-7131f7991bdd?auto=format&fit=crop&w=800&q=80',
    description: 'Корпус прототипа для тестирования эргономики.',
    material: 'ABS',
    size: '260×140×70 мм',
    technology: 'FDM',
    printTime: '13 часов',
    color: 'Белый'
  },
  {
    id: 'p11',
    title: 'Набор миниатюр D&D',
    category: 'Фигурки',
    price: 3100,
    image: 'https://images.unsplash.com/photo-1523731407965-2430cd12f5e4?auto=format&fit=crop&w=800&q=80',
    description: 'Комплект из 6 миниатюр для настольных игр.',
    material: 'RESIN',
    size: '30×30×50 мм',
    technology: 'SLA',
    printTime: '5 часов',
    color: 'Серый'
  },
  {
    id: 'p12',
    title: 'Корпус для умного дома',
    category: 'Гаджеты',
    price: 3700,
    image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80',
    description: 'Панель управления с отсеком под электронику.',
    material: 'PETG',
    size: '210×130×55 мм',
    technology: 'FDM',
    printTime: '6 часов',
    color: 'Белый'
  }
];

export const orders: Order[] = [
  {
    id: 'o1',
    status: 'printing',
    total: 7700,
    createdAt: '2024-08-03',
    items: [
      {
        productId: products[0].id,
        name: products[0].title,
        price: products[0].price,
        qty: 1
      },
      {
        productId: products[3].id,
        name: products[3].title,
        price: products[3].price,
        qty: 2
      }
    ]
  },
  {
    id: 'o2',
    status: 'delivered',
    total: 5200,
    createdAt: '2024-07-18',
    items: [
      {
        productId: products[4].id,
        name: products[4].title,
        price: products[4].price,
        qty: 1
      }
    ]
  }
];
