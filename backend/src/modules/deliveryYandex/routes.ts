/**
 * Express router for delivery Yandex module. Wiring only.
 */

import { Router } from 'express';
import { getPickupPointsByCity, postPickupPointsList } from './controllers/pickupPoints.controller';

export const deliveryYandexRoutes = Router();

deliveryYandexRoutes.get('/pickup-points', getPickupPointsByCity);
deliveryYandexRoutes.post('/pickup-points', postPickupPointsList);
