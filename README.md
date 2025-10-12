# Sistema de Gestión de Préstamos

Sistema full-stack para la gestión de préstamos personales con seguimiento de pagos, clientes, y reportes financieros.

## Tecnologías

### Backend
- **NestJS** 10+
- **TypeORM**
- **PostgreSQL**
- **JWT Authentication**
- **Class Validator**

### Frontend
- **Angular** 18+ (Standalone Components)
- **Angular Material**
- **RxJS**
- **SweetAlert2**

## Estructura del Proyecto

```
prestamos/
├── prestamos-backend/       # API REST con NestJS
├── prestamos-frontend/      # Aplicación Angular
└── PROJECT_DOCUMENTATION.md # Documentación completa
```

## Requisitos Previos

- Node.js 20.x
- PostgreSQL 14+
- npm 10.x

## Instalación

### 1. Clonar el Repositorio

```bash
git clone <repository-url>
cd prestamos
```

### 2. Configurar Backend

```bash
cd prestamos-backend
npm install
```

Crear archivo `.env` en `prestamos-backend/`:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=tu_password
DB_DATABASE=prestamos_db

# JWT
JWT_SECRET=tu_jwt_secret_key
JWT_EXPIRATION=24h

# Server
PORT=3000
```

Crear la base de datos:

```sql
CREATE DATABASE prestamos_db;
```

Ejecutar migraciones:

```bash
npm run migration:run
```

Ejecutar seeder (opcional):

```bash
npm run seed
```

### 3. Configurar Frontend

```bash
cd ../prestamos-frontend
npm install
```

Configurar archivo de entorno en `prestamos-frontend/src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api'
};
```

## Ejecutar el Proyecto

### Backend (Terminal 1)

```bash
cd prestamos-backend
npm run start:dev
```

El backend estará disponible en: `http://localhost:3000`

### Frontend (Terminal 2)

```bash
cd prestamos-frontend
npm start
```

El frontend estará disponible en: `http://localhost:4200`

## Compilar para Producción

### Backend

```bash
cd prestamos-backend
npm run build
```

Los archivos compilados estarán en `prestamos-backend/dist/`

Para ejecutar en producción:

```bash
npm run start:prod
```

### Frontend

```bash
cd prestamos-frontend
npm run build
```

Los archivos compilados estarán en `prestamos-frontend/dist/prestamos-frontend/`

Para servir en producción, usar un servidor web como **Nginx** o **Apache**.

## Características Principales

### Gestión de Clientes
- CRUD completo de clientes
- Historial de préstamos por cliente

### Tipos de Préstamos

#### Préstamo Cápsula (Plazo Fijo)
- Plazo definido (meses o quincenas)
- Pagos programados automáticos
- Seguimiento de períodos vencidos

#### Préstamo Indefinido
- Sin plazo definido
- Pago flexible de interés y capital
- Ideal para líneas de crédito

### Sistema de Pagos
- Registro de pagos con distribución automática (interés/capital)
- Cargos extras opcionales (mora)
- Historial completo de pagos
- Números de recibo automáticos

### Dashboard
- Métricas en tiempo real
- Total prestado y recuperado
- Intereses recabados
- Préstamos vencidos
- Préstamos por vencer
- Estadísticas por tipo de préstamo

### Movimientos de Caja
- Registro automático de entradas y salidas
- Saldo actualizado en tiempo real
- Historial completo de transacciones

## Usuarios por Defecto (Seeder)

```
Usuario: admin
Contraseña: admin123
```

## Documentación

Para información detallada sobre:
- Arquitectura del sistema
- Modelo de base de datos
- Flujos de negocio
- Reglas de cálculo
- API Endpoints
- Convenciones de código

Consultar: **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)**

## Scripts Disponibles

### Backend

```bash
npm run start:dev    # Desarrollo con hot-reload
npm run build        # Compilar para producción
npm run start:prod   # Ejecutar en producción
npm run migration:generate  # Generar migración
npm run migration:run       # Ejecutar migraciones
npm run seed         # Ejecutar seeder
```

### Frontend

```bash
npm start            # Desarrollo (http://localhost:4200)
npm run build        # Compilar para producción
npm run build --configuration production  # Build optimizado
npm test             # Ejecutar tests
```

## Estructura de la Base de Datos

### Tablas Principales

- **users**: Usuarios del sistema
- **customers**: Clientes
- **loans**: Préstamos
- **payments**: Pagos realizados
- **monthly_payments**: Pagos programados (solo para préstamos cápsula)
- **cash_movements**: Movimientos de caja

## Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Este proyecto es privado y de uso interno.

## Contacto

Para consultas o soporte, contactar al administrador del sistema.

---

**Versión:** 1.0
**Última Actualización:** 2024-10-12
