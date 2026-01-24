"""Physics engine for projectile motion calculations."""

import numpy as np


class Projectile:
    """A class to model projectile motion in 2D with optional air resistance."""

    def __init__(self, v0: float, theta: float, g: float = 9.81, cd: float = 0.0):
        """
        Initialize a projectile with initial conditions.

        Parameters
        ----------
        v0 : float
            Initial velocity in m/s
        theta : float
            Launch angle in degrees
        g : float
            Acceleration due to gravity in m/s² (default: 9.81)
        cd : float
            Drag coefficient in kg/m (default: 0.0, no air resistance)
            The drag force is F_d = -cd * v^2 * (v/|v|)
        """
        self.v0 = v0
        self.theta_deg = theta
        self.theta_rad = np.deg2rad(theta)
        self.g = g
        self.cd = cd

        # Calculate initial velocity components
        self.v0x = v0 * np.cos(self.theta_rad)
        self.v0y = v0 * np.sin(self.theta_rad)

    def time_of_flight(self) -> float:
        """
        Calculate the total time of flight (vacuum solution).

        Returns
        -------
        float
            Time of flight in seconds
        """
        if self.v0y <= 0:
            return 0.0
        return 2 * self.v0y / self.g

    def max_height(self) -> float:
        """
        Calculate the maximum height reached (vacuum solution).

        Returns
        -------
        float
            Maximum height in meters
        """
        if self.v0y <= 0:
            return 0.0
        return (self.v0y**2) / (2 * self.g)

    def range(self) -> float:
        """
        Calculate the horizontal range (vacuum solution).

        Returns
        -------
        float
            Range in meters
        """
        t_flight = self.time_of_flight()
        return self.v0x * t_flight

    def position(self, t: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """
        Calculate x and y positions at given times (vacuum solution).

        Parameters
        ----------
        t : np.ndarray
            Array of time values in seconds

        Returns
        -------
        tuple[np.ndarray, np.ndarray]
            Tuple of (x positions, y positions) in meters
        """
        x = self.v0x * t
        y = self.v0y * t - 0.5 * self.g * t**2

        # Set y to 0 for times after landing
        t_flight = self.time_of_flight()
        y[t > t_flight] = 0

        return x, y

    def trajectory(self, num_points: int = 100) -> tuple[np.ndarray, np.ndarray]:
        """
        Generate trajectory points from launch to landing.
        Uses vacuum solution if cd=0, otherwise uses numerical integration.

        Parameters
        ----------
        num_points : int
            Number of points to generate (default: 100)

        Returns
        -------
        tuple[np.ndarray, np.ndarray]
            Tuple of (x positions, y positions) in meters
        """
        if self.cd == 0.0:
            # Use analytical solution for vacuum
            return self._trajectory_vacuum(num_points)
        else:
            # Use numerical integration for air resistance
            return self._trajectory_with_drag(num_points)

    def _trajectory_vacuum(self, num_points: int = 100) -> tuple[np.ndarray, np.ndarray]:
        """
        Generate trajectory points using analytical vacuum solution.

        Parameters
        ----------
        num_points : int
            Number of points to generate

        Returns
        -------
        tuple[np.ndarray, np.ndarray]
            Tuple of (x positions, y positions) in meters
        """
        t_flight = self.time_of_flight()
        if t_flight <= 0:
            return np.array([0.0]), np.array([0.0])

        t = np.linspace(0, t_flight, num_points)
        return self.position(t)

    def _trajectory_with_drag(self, num_points: int = 100) -> tuple[np.ndarray, np.ndarray]:
        """
        Generate trajectory points using vectorized Symplectic Euler-Cromer integration.

        Parameters
        ----------
        num_points : int
            Number of points to generate

        Returns
        -------
        tuple[np.ndarray, np.ndarray]
            Tuple of (x positions, y positions) in meters
        """
        if self.v0 <= 0:
            return np.array([0.0]), np.array([0.0])

        # Time step - optimized for performance
        dt = 0.01  # seconds
        max_steps = 10000  # maximum number of steps (100 seconds / 0.01)
        
        # Pre-allocate arrays for maximum performance
        # We'll resize later if needed
        x_array = np.zeros(max_steps + 1, dtype=np.float64)
        y_array = np.zeros(max_steps + 1, dtype=np.float64)
        vx_array = np.zeros(max_steps + 1, dtype=np.float64)
        vy_array = np.zeros(max_steps + 1, dtype=np.float64)
        
        # Initialize first values
        x_array[0] = 0.0
        y_array[0] = 0.0
        vx_array[0] = self.v0x
        vy_array[0] = self.v0y
        
        # Vectorized integration loop
        for i in range(max_steps):
            # Current state
            x_curr = x_array[i]
            y_curr = y_array[i]
            vx_curr = vx_array[i]
            vy_curr = vy_array[i]
            
            # Check if we've hit the ground
            if y_curr < 0:
                # Interpolate to find exact landing point
                if i > 0:
                    y_prev = y_array[i - 1]
                    if y_prev > 0:
                        # Linear interpolation to find x when y=0
                        t_frac = -y_prev / (y_curr - y_prev)
                        x_landing = x_array[i - 1] + (x_curr - x_array[i - 1]) * t_frac
                        x_array[i] = x_landing
                        y_array[i] = 0.0
                        # Trim arrays to actual length
                        x_array = x_array[:i + 1]
                        y_array = y_array[:i + 1]
                        break
                else:
                    x_array = x_array[:1]
                    y_array = y_array[:1]
                    break
            
            # Calculate speed using vectorized operation
            v = np.sqrt(vx_curr * vx_curr + vy_curr * vy_curr)
            
            if v < 1e-6:  # Stop if velocity is negligible
                x_array = x_array[:i + 1]
                y_array = y_array[:i + 1]
                break
            
            # Calculate drag force components (vectorized)
            # F_d = -cd * v^2 * (v/|v|) = -cd * v * v_vector
            drag_x = -self.cd * v * vx_curr
            drag_y = -self.cd * v * vy_curr
            
            # Calculate accelerations (vectorized)
            ax = drag_x  # No gravity in x-direction
            ay = -self.g + drag_y  # Gravity + drag in y-direction
            
            # Symplectic Euler-Cromer: update velocity first, then position
            vx_next = vx_curr + ax * dt
            vy_next = vy_curr + ay * dt
            
            # Update position using new velocity
            x_next = x_curr + vx_next * dt
            y_next = y_curr + vy_next * dt
            
            # Store next state
            x_array[i + 1] = x_next
            y_array[i + 1] = y_next
            vx_array[i + 1] = vx_next
            vy_array[i + 1] = vy_next
        
        # Downsample to requested number of points if needed (vectorized)
        if len(x_array) > num_points:
            indices = np.linspace(0, len(x_array) - 1, num_points, dtype=int)
            x_array = x_array[indices]
            y_array = y_array[indices]
        
        return x_array, y_array

    def trajectory_vacuum(self, num_points: int = 100) -> tuple[np.ndarray, np.ndarray]:
        """
        Generate trajectory points using vacuum solution (no air resistance).

        Parameters
        ----------
        num_points : int
            Number of points to generate

        Returns
        -------
        tuple[np.ndarray, np.ndarray]
            Tuple of (x positions, y positions) in meters
        """
        return self._trajectory_vacuum(num_points)

    def check_hit(self, target_x: float, target_y: float, threshold: float = 1.5) -> bool:
        """
        Check if the projectile hits the target.

        Parameters
        ----------
        target_x : float
            X coordinate of the target in meters
        target_y : float
            Y coordinate of the target in meters
        threshold : float
            Hit detection threshold in meters (default: 1.5)

        Returns
        -------
        bool
            True if the projectile passes within threshold distance of the target
        """
        # Get trajectory points with high resolution for accurate hit detection
        x, y = self.trajectory(num_points=1000)

        if len(x) == 0 or len(y) == 0:
            return False

        # Calculate distances from target to each point on trajectory
        distances = np.sqrt((x - target_x) ** 2 + (y - target_y) ** 2)

        # Check if minimum distance is within threshold
        min_distance = np.min(distances)
        return min_distance <= threshold
