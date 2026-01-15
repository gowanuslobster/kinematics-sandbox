"""Physics engine for projectile motion calculations."""

import numpy as np


class Projectile:
    """A class to model projectile motion in 2D."""

    def __init__(self, v0: float, theta: float, g: float = 9.81):
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
        """
        self.v0 = v0
        self.theta_deg = theta
        self.theta_rad = np.deg2rad(theta)
        self.g = g

        # Calculate initial velocity components
        self.v0x = v0 * np.cos(self.theta_rad)
        self.v0y = v0 * np.sin(self.theta_rad)

    def time_of_flight(self) -> float:
        """
        Calculate the total time of flight.

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
        Calculate the maximum height reached.

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
        Calculate the horizontal range.

        Returns
        -------
        float
            Range in meters
        """
        t_flight = self.time_of_flight()
        return self.v0x * t_flight

    def position(self, t: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """
        Calculate x and y positions at given times.

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

        Parameters
        ----------
        num_points : int
            Number of points to generate (default: 100)

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
