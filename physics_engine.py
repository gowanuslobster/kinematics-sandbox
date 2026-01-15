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
        Generate trajectory points using Symplectic Euler-Cromer integration.

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

        # Time step - adaptive based on initial velocity
        dt = 0.01  # seconds
        max_time = 100.0  # maximum simulation time

        # Initialize arrays
        x_list = [0.0]
        y_list = [0.0]
        vx = self.v0x
        vy = self.v0y

        t = 0.0
        while y_list[-1] >= 0 and t < max_time:
            # Calculate speed
            v = np.sqrt(vx**2 + vy**2)

            if v < 1e-6:  # Stop if velocity is negligible
                break

            # Calculate drag force components
            # F_d = -cd * v^2 * (v/|v|) = -cd * v * v_vector
            drag_x = -self.cd * v * vx
            drag_y = -self.cd * v * vy

            # Calculate accelerations
            ax = drag_x  # No gravity in x-direction
            ay = -self.g + drag_y  # Gravity + drag in y-direction

            # Symplectic Euler-Cromer: update velocity first, then position
            vx = vx + ax * dt
            vy = vy + ay * dt

            # Update position using new velocity
            x_new = x_list[-1] + vx * dt
            y_new = y_list[-1] + vy * dt

            # Stop if projectile hits ground
            if y_new < 0:
                # Interpolate to find exact landing point
                if len(y_list) > 0:
                    y_prev = y_list[-1]
                    if y_prev > 0:
                        # Linear interpolation to find x when y=0
                        t_frac = -y_prev / (y_new - y_prev)
                        x_landing = x_list[-1] + (x_new - x_list[-1]) * t_frac
                        x_list.append(x_landing)
                        y_list.append(0.0)
                break

            x_list.append(x_new)
            y_list.append(y_new)
            t += dt

        # Convert to numpy arrays
        x_array = np.array(x_list)
        y_array = np.array(y_list)

        # Downsample to requested number of points if needed
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
