using System;
using Microsoft.EntityFrameworkCore;

namespace ParentalSkipper.Data
{
    public class ParentalSkipperDbContext : DbContext
    {
        private readonly string _dbPath;

        public ParentalSkipperDbContext(string dbPath)
        {
            _dbPath = dbPath;
            Segments = Set<Segment>();
        }

        public DbSet<Segment> Segments { get; set; }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            optionsBuilder.UseSqlite($"Data Source={_dbPath}");
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Segment>(entity =>
            {
                entity.ToTable("Segments");
                entity.HasKey(s => s.Id);
                entity.HasIndex(e => e.ItemId);
                
                entity.Property(e => e.Start).IsRequired();
                entity.Property(e => e.End).IsRequired();
                entity.Property(e => e.Reason).HasMaxLength(500);
            });

            base.OnModelCreating(modelBuilder);
        }

        public void Initialize()
        {
            Database.EnsureCreated();
            
            // Add Reason column if it doesn't exist (migration for existing databases)
            try
            {
                using var connection = Database.GetDbConnection();
                connection.Open();
                using var command = connection.CreateCommand();
                
                // Check if Reason column exists
                command.CommandText = "PRAGMA table_info(Segments)";
                using var reader = command.ExecuteReader();
                bool reasonExists = false;
                while (reader.Read())
                {
                    if (reader.GetString(1) == "Reason")
                    {
                        reasonExists = true;
                        break;
                    }
                }
                reader.Close();
                
                // Add Reason column if missing
                if (!reasonExists)
                {
                    command.CommandText = "ALTER TABLE Segments ADD COLUMN Reason TEXT NULL";
                    command.ExecuteNonQuery();
                }
            }
            catch (Exception)
            {
                // Silently ignore if migration fails - likely already applied
            }
        }
    }
}
