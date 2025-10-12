# Guía de Análisis de Proyecto para Gemini

**Nota Importante:** Todas las instrucciones, explicaciones y comunicaciones deben ser proporcionadas en **español latinoamericano**.

Este documento establece el flujo de trabajo estándar para analizar el proyecto "Préstamos" antes de abordar cualquier solicitud de desarrollo, modificación o corrección de errores. El objetivo es asegurar una comprensión holística de la arquitectura, el flujo de datos y las tecnologías involucradas.

## Proceso de Análisis General

Antes de implementar cualquier cambio, sigue estos tres pasos fundamentales:

### 1. Análisis del Backend (NestJS)

El objetivo es entender la lógica de negocio, la API y la estructura del servidor.

-   **Revisar la Configuración Principal:**
    -   Analizar `prestamos-backend/package.json` para identificar scripts (`start`, `build`, `test`) y dependencias clave (e.g., `@nestjs/core`, `typeorm`, `passport`).
    -   Examinar `prestamos-backend/src/main.ts` para entender cómo se inicializa la aplicación NestJS y qué módulos globales o interceptores se aplican.

-   **Entender la API y la Lógica de Negocio:**
    -   Listar los módulos en `prestamos-backend/src/`.
    -   Para el módulo relevante, inspeccionar el **Controlador** (`*.controller.ts`) para identificar los endpoints de la API, sus rutas, métodos HTTP y DTOs (`*.dto.ts`) esperados.
    -   Analizar el **Servicio** (`*.service.ts`) para comprender la lógica de negocio principal, cómo interactúa con el repositorio de la base de datos y con otros servicios.

### 2. Análisis de la Base de Datos (PostgreSQL con TypeORM)

El objetivo es comprender el esquema de datos, las relaciones y cómo se gestiona la persistencia.

-   **Identificar la Configuración de Conexión:**
    -   Revisar `prestamos-backend/typeorm.config.ts` y `prestamos-backend/.env` para entender cómo se conecta la aplicación a la base de datos PostgreSQL.

-   **Mapear el Modelo de Datos:**
    -   Buscar todos los archivos de entidad (`prestamos-backend/src/**/*.entity.ts`).
    -   Leer las entidades relevantes para la tarea para entender las columnas de la tabla, los tipos de datos y, lo más importante, las **relaciones** (`@ManyToOne`, `@OneToMany`, `@OneToOne`, `@ManyToMany`).
    -   Visualizar mentalmente cómo se conectan las tablas (e.g., `User` -> `Customer` -> `Loan` -> `Payment`).

-   **Verificar Migraciones y Seeds:**
    -   Revisar los directorios `database/migrations` y `database/seeds` para entender cómo ha evolucionado el esquema y cómo se pueblan los datos iniciales.

### 3. Análisis del Frontend (Angular)

El objetivo es entender la estructura de la interfaz de usuario, la gestión del estado y la comunicación con el backend.

-   **Revisar la Configuración Principal:**
    -   Analizar `prestamos-frontend/package.json` para identificar scripts (`start`, `build`, `test`) y dependencias clave (e.g., `@angular/core`, `@angular/common/http`, `rxjs`).
    -   Examinar `prestamos-frontend/angular.json` para entender la estructura del proyecto y la configuración de compilación.
    -   Verificar `prestamos-frontend/src/environments/` para determinar cómo se configura la URL de la API del backend.

-   **Entender el Flujo de la Interfaz de Usuario:**
    -   Revisar el archivo de rutas principal (`app.routes.ts`) para entender la navegación de la aplicación.
    -   Para la funcionalidad relevante, localizar el **Componente** (`*.component.ts`) responsable de la vista. Analizar su plantilla (`*.html`) y estilos (`*.css`).
    -   Inspeccionar el **Servicio de Angular** (`*.service.ts` en `src/app/core/services/`) que el componente utiliza para comunicarse con el backend. Prestar especial atención a los métodos de `HttpClient` y las URLs que consume.

## Conclusión

Al seguir estos pasos, se garantiza que cualquier solución propuesta sea consistente con la arquitectura existente, segura y eficiente. Este análisis previo es un paso crítico para minimizar errores y retrabajo.

## Directrices Adicionales

-   Únicamente si el usuario menciona que haga alguna modificación en el diseño, se realizará. De lo contrario, jamás se modificará por cuenta propia el diseño de la plataforma.